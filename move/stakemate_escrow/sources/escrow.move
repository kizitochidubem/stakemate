/// Stakemate wager escrow.
///
/// Locks SUI from two sides of a chess match in a shared Registry object.
/// A trusted oracle (whoever creates the match) settles the match and the
/// program pays out winners pro-rata minus a configurable fee that goes to
/// the treasury. Solo bettors (no counter-stake) are topped up from a
/// shared liquidity vault up to their quoted odds.
///
/// Flow:
///   1. create_match            - oracle creates a Match entry, keyed by id
///   2. place_wager             - users place wagers on white or black, SUI
///                                is held in the Match's balance
///   3. settle_match            - oracle calls with the result; skims the
///                                fee from the losing pool to the treasury
///   4. claim_payout            - winning/refund recipients pull their funds
///   5. cancel_match            - oracle marks an unfinishable match
///                                cancelled; everyone claim_payout's their
///                                stake back
///   6. transfer_match_oracle   - current oracle hands authority to a new
///                                address (key rotation / multisig handoff)
///   7. deposit_liquidity       - anyone tops up the shared liquidity vault
///
/// Trust model:
///   - Oracle (server) decides who won. Same trust model as a centralized
///     sportsbook. A future version can plug in a verifiable game-state
///     oracle.
///   - Funds, math, payout - all on-chain. No human in the loop.
///   - Settlement is one-way: Open -> Settled or Open -> Cancelled. Once
///     Settled or Cancelled the result is immutable.
module stakemate::escrow;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use sui::table::{Self, Table};

// === Constants ===

const MAX_FEE_BPS: u64 = 500; // 5%
const MIN_ODDS_BPS: u64 = 10_000; // 1.00x

const STATUS_OPEN: u8 = 0;
const STATUS_SETTLED: u8 = 1;
const STATUS_CANCELLED: u8 = 2;

const SIDE_WHITE: u8 = 0;
const SIDE_BLACK: u8 = 1;

const OUTCOME_DRAW: u8 = 0;
const OUTCOME_WHITE: u8 = 1;
const OUTCOME_BLACK: u8 = 2;

// === Errors ===

const EFeeTooHigh: u64 = 0;
const EZeroAmount: u64 = 1;
const EMatchClosed: u64 = 2;
const ENotSettled: u64 = 3;
const EUnauthorized: u64 = 4;
const EAlreadyClaimed: u64 = 5;
const EInvalidOracle: u64 = 6;
const EInvalidOdds: u64 = 7;
const EMatchExists: u64 = 8;
const EWagerExists: u64 = 9;
const EInvalidSide: u64 = 10;
const EInvalidOutcome: u64 = 11;

// === Structs ===

/// Shared object holding every match and the global liquidity vault.
public struct Registry has key {
    id: UID,
    matches: Table<vector<u8>, Match>,
    liquidity: Balance<SUI>,
}

/// Per-match escrow state, stored as a value inside `Registry.matches`.
public struct Match has store {
    oracle: address,
    treasury: address,
    fee_bps: u64,
    status: u8,
    winner: u8,
    total_white: u64,
    total_black: u64,
    fee_collected: u64,
    balance: Balance<SUI>,
    wagers: Table<address, Wager>,
}

/// Per-user wager record, stored inside `Match.wagers`.
public struct Wager has store {
    amount: u64,
    side: u8,
    odds_bps: u64,
    claimed: bool,
}

// === Events ===

public struct MatchCreated has copy, drop {
    match_id: vector<u8>,
    oracle: address,
    treasury: address,
    fee_bps: u64,
}

public struct WagerPlaced has copy, drop {
    match_id: vector<u8>,
    user: address,
    amount: u64,
    side: u8,
    odds_bps: u64,
}

public struct LiquidityDeposited has copy, drop {
    depositor: address,
    amount: u64,
}

public struct MatchSettled has copy, drop {
    match_id: vector<u8>,
    winner: u8,
    fee_collected: u64,
}

public struct PayoutClaimed has copy, drop {
    match_id: vector<u8>,
    user: address,
    amount: u64,
}

public struct MatchCancelled has copy, drop {
    match_id: vector<u8>,
    oracle: address,
}

public struct OracleTransferred has copy, drop {
    match_id: vector<u8>,
    previous: address,
    current: address,
}

// === Init ===

fun init(ctx: &mut TxContext) {
    let registry = Registry {
        id: object::new(ctx),
        matches: table::new(ctx),
        liquidity: balance::zero(),
    };
    transfer::share_object(registry);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx)
}

// === Entry functions ===

/// Create a new match escrow. The caller becomes the oracle for this
/// match - only they can settle, cancel, or transfer it.
public fun create_match(
    registry: &mut Registry,
    match_id: vector<u8>,
    fee_bps: u64,
    treasury: address,
    ctx: &mut TxContext,
) {
    assert!(fee_bps <= MAX_FEE_BPS, EFeeTooHigh);
    assert!(!table::contains(&registry.matches, match_id), EMatchExists);

    let oracle = ctx.sender();
    let m = Match {
        oracle,
        treasury,
        fee_bps,
        status: STATUS_OPEN,
        winner: OUTCOME_DRAW,
        total_white: 0,
        total_black: 0,
        fee_collected: 0,
        balance: balance::zero(),
        wagers: table::new(ctx),
    };
    table::add(&mut registry.matches, match_id, m);

    event::emit(MatchCreated { match_id, oracle, treasury, fee_bps });
}

/// Lock SUI into the match escrow on a side (white or black). One wager
/// per (match, user) is recorded so the user can be paid out individually.
public fun place_wager(
    registry: &mut Registry,
    match_id: vector<u8>,
    side: u8,
    odds_bps: u64,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(side == SIDE_WHITE || side == SIDE_BLACK, EInvalidSide);
    assert!(odds_bps >= MIN_ODDS_BPS, EInvalidOdds);

    let amount = coin::value(&payment);
    assert!(amount > 0, EZeroAmount);

    let user = ctx.sender();
    let m = table::borrow_mut(&mut registry.matches, match_id);
    assert!(m.status == STATUS_OPEN, EMatchClosed);
    assert!(!table::contains(&m.wagers, user), EWagerExists);

    balance::join(&mut m.balance, coin::into_balance(payment));

    if (side == SIDE_WHITE) {
        m.total_white = m.total_white + amount;
    } else {
        m.total_black = m.total_black + amount;
    };

    table::add(&mut m.wagers, user, Wager { amount, side, odds_bps, claimed: false });

    event::emit(WagerPlaced { match_id, user, amount, side, odds_bps });
}

/// Top up the shared liquidity vault used to subsidize solo-bettor payouts.
public fun deposit_liquidity(registry: &mut Registry, payment: Coin<SUI>, ctx: &mut TxContext) {
    let amount = coin::value(&payment);
    assert!(amount > 0, EZeroAmount);

    let depositor = ctx.sender();
    balance::join(&mut registry.liquidity, coin::into_balance(payment));

    event::emit(LiquidityDeposited { depositor, amount });
}

/// Oracle records the winning side. Fee is skimmed from the losing pool
/// and sent to the treasury. After this call the match is closed and
/// users can claim their payouts.
public fun settle_match(
    registry: &mut Registry,
    match_id: vector<u8>,
    winner: u8,
    ctx: &mut TxContext,
) {
    assert!(
        winner == OUTCOME_DRAW || winner == OUTCOME_WHITE || winner == OUTCOME_BLACK,
        EInvalidOutcome,
    );

    let m = table::borrow_mut(&mut registry.matches, match_id);
    assert!(m.status == STATUS_OPEN, EMatchClosed);
    assert!(m.oracle == ctx.sender(), EUnauthorized);

    m.winner = winner;
    m.status = STATUS_SETTLED;

    if (winner != OUTCOME_DRAW) {
        let losing_pool = if (winner == OUTCOME_WHITE) { m.total_black } else { m.total_white };
        let fee = (((losing_pool as u128) * (m.fee_bps as u128)) / 10_000) as u64;
        m.fee_collected = fee;

        if (fee > 0) {
            let fee_coin = coin::from_balance(balance::split(&mut m.balance, fee), ctx);
            transfer::public_transfer(fee_coin, m.treasury);
        };
    };

    event::emit(MatchSettled { match_id, winner, fee_collected: m.fee_collected });
}

/// Claim a payout after settlement or cancellation. On a draw or
/// cancellation the stake is refunded. On a win, the stake plus a
/// pro-rata share of the losing pool (minus fee) is paid out; if the
/// winner bet solo (no counter-stake), the shared liquidity vault tops
/// the payout up toward the quoted odds.
#[allow(lint(self_transfer))]
public fun claim_payout(registry: &mut Registry, match_id: vector<u8>, ctx: &mut TxContext) {
    let user = ctx.sender();

    let m = table::borrow_mut(&mut registry.matches, match_id);
    assert!(m.status != STATUS_OPEN, ENotSettled);

    let status = m.status;
    let winner = m.winner;
    let total_white = m.total_white;
    let total_black = m.total_black;
    let fee_bps = m.fee_bps;

    let w = table::borrow_mut(&mut m.wagers, user);
    assert!(!w.claimed, EAlreadyClaimed);

    let amount = w.amount;
    let side = w.side;
    let odds_bps = w.odds_bps;
    w.claimed = true;

    let vault_value = balance::value(&registry.liquidity);
    let (payout, from_liquidity) = compute_claim_payout(
        status,
        winner,
        side,
        amount,
        odds_bps,
        total_white,
        total_black,
        fee_bps,
        vault_value,
    );

    if (payout > 0) {
        let from_match = payout - from_liquidity;
        if (from_match > 0) {
            let payout_coin = coin::from_balance(balance::split(&mut m.balance, from_match), ctx);
            transfer::public_transfer(payout_coin, user);
        };
        if (from_liquidity > 0) {
            let subsidy_coin = coin::from_balance(balance::split(&mut registry.liquidity, from_liquidity), ctx);
            transfer::public_transfer(subsidy_coin, user);
        };
    };

    event::emit(PayoutClaimed { match_id, user, amount: payout });
}

/// Oracle cancels an unfinishable match. Cancelled matches refund every
/// wager at face value via `claim_payout`. No fee is taken, no winner is
/// recorded. Like settlement, this is one-way.
public fun cancel_match(registry: &mut Registry, match_id: vector<u8>, ctx: &mut TxContext) {
    let m = table::borrow_mut(&mut registry.matches, match_id);
    assert!(m.status == STATUS_OPEN, EMatchClosed);
    assert!(m.oracle == ctx.sender(), EUnauthorized);

    m.status = STATUS_CANCELLED;

    event::emit(MatchCancelled { match_id, oracle: m.oracle });
}

/// Current oracle transfers oracle authority for this match to a new
/// address. Useful for server key rotation or moving a high-value match
/// to a multisig oracle.
public fun transfer_match_oracle(
    registry: &mut Registry,
    match_id: vector<u8>,
    new_oracle: address,
    ctx: &mut TxContext,
) {
    let m = table::borrow_mut(&mut registry.matches, match_id);
    assert!(m.oracle == ctx.sender(), EUnauthorized);
    assert!(new_oracle != @0x0, EInvalidOracle);

    let previous = m.oracle;
    m.oracle = new_oracle;

    event::emit(OracleTransferred { match_id, previous, current: new_oracle });
}

// === Read-only helpers ===

public fun match_exists(registry: &Registry, match_id: vector<u8>): bool {
    table::contains(&registry.matches, match_id)
}

public fun match_info(
    registry: &Registry,
    match_id: vector<u8>,
): (address, address, u64, u8, u8, u64, u64, u64, u64) {
    let m = table::borrow(&registry.matches, match_id);
    (
        m.oracle,
        m.treasury,
        m.fee_bps,
        m.status,
        m.winner,
        m.total_white,
        m.total_black,
        m.fee_collected,
        balance::value(&m.balance),
    )
}

public fun has_wager(registry: &Registry, match_id: vector<u8>, user: address): bool {
    let m = table::borrow(&registry.matches, match_id);
    table::contains(&m.wagers, user)
}

public fun wager_info(registry: &Registry, match_id: vector<u8>, user: address): (u64, u8, u64, bool) {
    let m = table::borrow(&registry.matches, match_id);
    let w = table::borrow(&m.wagers, user);
    (w.amount, w.side, w.odds_bps, w.claimed)
}

public fun liquidity_value(registry: &Registry): u64 {
    balance::value(&registry.liquidity)
}

// === Pure payout math (ported from the Anchor program) ===

fun compute_claim_payout(
    status: u8,
    winner: u8,
    side: u8,
    amount: u64,
    odds_bps: u64,
    total_white: u64,
    total_black: u64,
    fee_bps: u64,
    vault_value: u64,
): (u64, u64) {
    if (status == STATUS_CANCELLED) {
        return (amount, 0)
    };

    // STATUS_SETTLED
    if (winner == OUTCOME_DRAW) {
        return (amount, 0)
    };

    let is_winner =
        (winner == OUTCOME_WHITE && side == SIDE_WHITE) || (winner == OUTCOME_BLACK && side == SIDE_BLACK);
    if (!is_winner) {
        return (0, 0)
    };

    let (winning_pool, losing_pool) = if (side == SIDE_WHITE) {
        (total_white, total_black)
    } else {
        (total_black, total_white)
    };

    let (pari, subsidy) = winner_payout(amount, odds_bps, winning_pool, losing_pool, fee_bps, vault_value);
    (pari + subsidy, subsidy)
}

/// Returns (pari_mutuel_payout, liquidity_subsidy).
fun winner_payout(
    own_stake: u64,
    odds_bps: u64,
    winning_pool: u64,
    losing_pool: u64,
    fee_bps: u64,
    vault_value: u64,
): (u64, u64) {
    let pari = payout_for_winner(own_stake, winning_pool, losing_pool, fee_bps);
    if (losing_pool > 0) {
        return (pari, 0)
    };

    let target = subsidized_payout(own_stake, odds_bps, fee_bps);
    if (target <= pari) {
        return (pari, 0)
    };

    let subsidy = target - pari;
    let subsidy = if (subsidy < vault_value) { subsidy } else { vault_value };
    (pari, subsidy)
}

/// Target payout for a solo bettor (no counter-stake), based on quoted odds.
fun subsidized_payout(stake: u64, odds_bps: u64, fee_bps: u64): u64 {
    let gross = (((stake as u128) * (odds_bps as u128)) / 10_000) as u64;
    if (gross <= stake) {
        return stake
    };

    let profit = gross - stake;
    let fee = (((profit as u128) * (fee_bps as u128)) / 10_000) as u64;
    stake + profit - fee
}

/// Pro-rata payout for one wager on the winning side:
/// stake + (own_share_of_winning_pool * losing_pool_after_fee).
///
/// Integer division truncates - a few MIST of dust per winner stay locked
/// in the match balance. Benign at this scale.
fun payout_for_winner(own_stake: u64, winning_pool: u64, losing_pool: u64, fee_bps: u64): u64 {
    if (winning_pool == 0) {
        return own_stake
    };

    let fee = (((losing_pool as u128) * (fee_bps as u128)) / 10_000) as u64;
    let distributable = if (losing_pool > fee) { losing_pool - fee } else { 0 };
    let share = (((distributable as u128) * (own_stake as u128)) / (winning_pool as u128)) as u64;
    own_stake + share
}
