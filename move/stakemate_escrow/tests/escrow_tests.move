#[test_only]
module stakemate::escrow_tests;

use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario as ts;
use stakemate::escrow::{Self, Registry};

const ORACLE: address = @0xA11CE;
const TREASURY: address = @0xFEE;
const WHITE_BETTOR: address = @0xB0B;
const BLACK_BETTOR: address = @0xCAFE;
const SOLO_BETTOR: address = @0xD00D;

const MATCH_ID: vector<u8> = b"0123456789abcdef";

const SIDE_WHITE: u8 = 0;
const SIDE_BLACK: u8 = 1;

const OUTCOME_DRAW: u8 = 0;
const OUTCOME_WHITE: u8 = 1;

const FEE_BPS: u64 = 300; // 3%

const ONE_SUI: u64 = 1_000_000_000;

#[test]
fun test_create_wager_settle_claim_white_wins() {
    let mut scenario = ts::begin(ORACLE);
    {
        let ctx = ts::ctx(&mut scenario);
        escrow::init_for_testing(ctx);
    };

    // Oracle creates the match.
    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::create_match(&mut registry, MATCH_ID, FEE_BPS, TREASURY, ctx);
        ts::return_shared(registry);
    };

    // White bettor stakes 1 SUI at 2x.
    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        let payment = coin::mint_for_testing<SUI>(ONE_SUI, ctx);
        escrow::place_wager(&mut registry, MATCH_ID, SIDE_WHITE, 20_000, payment, ctx);
        ts::return_shared(registry);
    };

    // Black bettor stakes 1 SUI at 2x.
    ts::next_tx(&mut scenario, BLACK_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        let payment = coin::mint_for_testing<SUI>(ONE_SUI, ctx);
        escrow::place_wager(&mut registry, MATCH_ID, SIDE_BLACK, 20_000, payment, ctx);
        ts::return_shared(registry);
    };

    // Oracle settles: white wins. Fee = 3% of the 1 SUI losing (black) pool.
    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::settle_match(&mut registry, MATCH_ID, OUTCOME_WHITE, ctx);
        ts::return_shared(registry);
    };

    // Treasury received the 3% fee skimmed from the losing pool.
    ts::next_tx(&mut scenario, TREASURY);
    {
        let fee_coin = ts::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&fee_coin) == 30_000_000, 0);
        ts::return_to_sender(&scenario, fee_coin);
    };

    // White bettor claims: stake back + losing pool minus fee.
    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::claim_payout(&mut registry, MATCH_ID, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let payout = ts::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&payout) == 1_970_000_000, 1);
        ts::return_to_sender(&scenario, payout);
    };

    // Black bettor claims: lost, payout is zero, nothing transferred.
    ts::next_tx(&mut scenario, BLACK_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::claim_payout(&mut registry, MATCH_ID, ctx);
        let (_, _, _, claimed) = escrow::wager_info(&registry, MATCH_ID, BLACK_BETTOR);
        assert!(claimed, 2);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

#[test]
fun test_draw_refunds_stakes() {
    let mut scenario = ts::begin(ORACLE);
    {
        let ctx = ts::ctx(&mut scenario);
        escrow::init_for_testing(ctx);
    };

    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::create_match(&mut registry, MATCH_ID, FEE_BPS, TREASURY, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        let payment = coin::mint_for_testing<SUI>(500_000_000, ctx);
        escrow::place_wager(&mut registry, MATCH_ID, SIDE_WHITE, 20_000, payment, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::settle_match(&mut registry, MATCH_ID, OUTCOME_DRAW, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::claim_payout(&mut registry, MATCH_ID, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let payout = ts::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&payout) == 500_000_000, 0);
        ts::return_to_sender(&scenario, payout);
    };

    ts::end(scenario);
}

#[test]
fun test_cancel_refunds_stake() {
    let mut scenario = ts::begin(ORACLE);
    {
        let ctx = ts::ctx(&mut scenario);
        escrow::init_for_testing(ctx);
    };

    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::create_match(&mut registry, MATCH_ID, FEE_BPS, TREASURY, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        let payment = coin::mint_for_testing<SUI>(750_000_000, ctx);
        escrow::place_wager(&mut registry, MATCH_ID, SIDE_WHITE, 15_000, payment, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::cancel_match(&mut registry, MATCH_ID, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::claim_payout(&mut registry, MATCH_ID, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let payout = ts::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&payout) == 750_000_000, 0);
        ts::return_to_sender(&scenario, payout);
    };

    ts::end(scenario);
}

/// A solo bettor (no counter-stake) wins and is topped up from the shared
/// liquidity vault toward their quoted odds.
#[test]
fun test_solo_bettor_gets_liquidity_subsidy() {
    let mut scenario = ts::begin(ORACLE);
    {
        let ctx = ts::ctx(&mut scenario);
        escrow::init_for_testing(ctx);
    };

    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::create_match(&mut registry, MATCH_ID, FEE_BPS, TREASURY, ctx);
        ts::return_shared(registry);
    };

    // Treasury seeds the liquidity vault with 1 SUI.
    ts::next_tx(&mut scenario, TREASURY);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        let payment = coin::mint_for_testing<SUI>(ONE_SUI, ctx);
        escrow::deposit_liquidity(&mut registry, payment, ctx);
        ts::return_shared(registry);
    };

    // Solo bettor stakes 1 SUI on white at 2x; nobody bets black.
    ts::next_tx(&mut scenario, SOLO_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        let payment = coin::mint_for_testing<SUI>(ONE_SUI, ctx);
        escrow::place_wager(&mut registry, MATCH_ID, SIDE_WHITE, 20_000, payment, ctx);
        ts::return_shared(registry);
    };

    // White wins; no losing pool, so no fee is collected.
    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::settle_match(&mut registry, MATCH_ID, OUTCOME_WHITE, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, SOLO_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::claim_payout(&mut registry, MATCH_ID, ctx);
        ts::return_shared(registry);
    };

    // Stake (1 SUI) from the match balance + 0.97 SUI subsidy from the
    // liquidity vault = 1.97 SUI total, matching the quoted 2x odds minus fee.
    ts::next_tx(&mut scenario, SOLO_BETTOR);
    {
        let stake_back = ts::take_from_sender<Coin<SUI>>(&scenario);
        let subsidy = ts::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&stake_back) + coin::value(&subsidy) == 1_970_000_000, 0);
        ts::return_to_sender(&scenario, stake_back);
        ts::return_to_sender(&scenario, subsidy);
    };

    // Vault had 1 SUI, paid out 0.97 SUI subsidy -> 0.03 SUI left.
    ts::next_tx(&mut scenario, ORACLE);
    {
        let registry = ts::take_shared<Registry>(&scenario);
        assert!(escrow::liquidity_value(&registry) == 30_000_000, 1);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = 0)] // EFeeTooHigh
fun test_create_match_fee_too_high_aborts() {
    let mut scenario = ts::begin(ORACLE);
    {
        let ctx = ts::ctx(&mut scenario);
        escrow::init_for_testing(ctx);
    };

    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::create_match(&mut registry, MATCH_ID, 600, TREASURY, ctx);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = 4)] // EUnauthorized
fun test_settle_match_wrong_oracle_aborts() {
    let mut scenario = ts::begin(ORACLE);
    {
        let ctx = ts::ctx(&mut scenario);
        escrow::init_for_testing(ctx);
    };

    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::create_match(&mut registry, MATCH_ID, FEE_BPS, TREASURY, ctx);
        ts::return_shared(registry);
    };

    // Someone other than the oracle tries to settle.
    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::settle_match(&mut registry, MATCH_ID, OUTCOME_DRAW, ctx);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = 5)] // EAlreadyClaimed
fun test_double_claim_aborts() {
    let mut scenario = ts::begin(ORACLE);
    {
        let ctx = ts::ctx(&mut scenario);
        escrow::init_for_testing(ctx);
    };

    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::create_match(&mut registry, MATCH_ID, FEE_BPS, TREASURY, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        let payment = coin::mint_for_testing<SUI>(ONE_SUI, ctx);
        escrow::place_wager(&mut registry, MATCH_ID, SIDE_WHITE, 20_000, payment, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, ORACLE);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::settle_match(&mut registry, MATCH_ID, OUTCOME_DRAW, ctx);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::claim_payout(&mut registry, MATCH_ID, ctx);
        ts::return_shared(registry);
    };

    // Second claim on the same wager aborts.
    ts::next_tx(&mut scenario, WHITE_BETTOR);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let ctx = ts::ctx(&mut scenario);
        escrow::claim_payout(&mut registry, MATCH_ID, ctx);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}
