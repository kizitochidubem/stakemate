/**
 * Client for the Stakemate escrow Move package (`stakemate::escrow`).
 *
 * Builds programmable transaction blocks (PTBs) for every entry function in
 * the shared `Registry` object. Signing/execution is left to the caller via
 * a `SignAndExecute` callback so this module works the same from a wallet
 * (dapp-kit's `useSignAndExecuteTransaction`) or a server-side keypair.
 *
 * Feature-flagged: only used when both `NEXT_PUBLIC_SUI_ESCROW_PACKAGE_ID`
 * and `NEXT_PUBLIC_SUI_ESCROW_REGISTRY_ID` are set. Otherwise the app falls
 * back to a direct treasury transfer in `src/lib/wager.ts`.
 */

import type { SuiClient } from "@/lib/sui/network";
import { Transaction } from "@mysten/sui/transactions";
import { MIST_PER_SUI, explorerTxUrl } from "@/lib/sui/network";
import { oddsToBps } from "@/lib/odds-bps";

export const ESCROW_PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_ESCROW_PACKAGE_ID?.trim() || null;
export const ESCROW_REGISTRY_ID = process.env.NEXT_PUBLIC_SUI_ESCROW_REGISTRY_ID?.trim() || null;

export const FEE_BPS = 300; // 3%

export function isEscrowEnabled(): boolean {
  return ESCROW_PACKAGE_ID !== null && ESCROW_REGISTRY_ID !== null;
}

export type EscrowSide = "white" | "black";
export type EscrowOutcome = "draw" | "white" | "black";

const SIDE_TO_U8: Record<EscrowSide, number> = { white: 0, black: 1 };
const OUTCOME_TO_U8: Record<EscrowOutcome, number> = { draw: 0, white: 1, black: 2 };

/** 16-byte match id, same encoding used across the app. */
export function matchIdBytes(idString: string): number[] {
  const out = new Uint8Array(16);
  const bytes = new TextEncoder().encode(idString);
  out.set(bytes.slice(0, 16));
  return Array.from(out);
}

export function suiToMist(amountSui: number): bigint {
  return BigInt(Math.round(amountSui * Number(MIST_PER_SUI)));
}

export function mistToSui(amountMist: number | bigint): number {
  return Number(amountMist) / Number(MIST_PER_SUI);
}

function moduleTarget(fn: string): `${string}::${string}::${string}` {
  if (!ESCROW_PACKAGE_ID) throw new Error("Escrow package is not configured");
  return `${ESCROW_PACKAGE_ID}::escrow::${fn}`;
}

function registryId(): string {
  if (!ESCROW_REGISTRY_ID) throw new Error("Escrow registry is not configured");
  return ESCROW_REGISTRY_ID;
}

// ============================================================
// PTB builders - one per entry function in sources/escrow.move
// ============================================================

export function buildCreateMatchTx({
  matchId,
  treasury,
  feeBps = FEE_BPS,
}: {
  matchId: string;
  treasury: string;
  feeBps?: number;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: moduleTarget("create_match"),
    arguments: [
      tx.object(registryId()),
      tx.pure.vector("u8", matchIdBytes(matchId)),
      tx.pure.u64(feeBps),
      tx.pure.address(treasury),
    ],
  });
  return tx;
}

export function buildPlaceWagerTx({
  matchId,
  side,
  oddsBps,
  amountMist,
}: {
  matchId: string;
  side: EscrowSide;
  oddsBps: number;
  amountMist: bigint;
}): Transaction {
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
  tx.moveCall({
    target: moduleTarget("place_wager"),
    arguments: [
      tx.object(registryId()),
      tx.pure.vector("u8", matchIdBytes(matchId)),
      tx.pure.u8(SIDE_TO_U8[side]),
      tx.pure.u64(oddsBps),
      payment,
    ],
  });
  return tx;
}

export function buildSettleMatchTx({
  matchId,
  winner,
}: {
  matchId: string;
  winner: EscrowOutcome;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: moduleTarget("settle_match"),
    arguments: [
      tx.object(registryId()),
      tx.pure.vector("u8", matchIdBytes(matchId)),
      tx.pure.u8(OUTCOME_TO_U8[winner]),
    ],
  });
  return tx;
}

export function buildClaimPayoutTx({ matchId }: { matchId: string }): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: moduleTarget("claim_payout"),
    arguments: [tx.object(registryId()), tx.pure.vector("u8", matchIdBytes(matchId))],
  });
  return tx;
}

export function buildCancelMatchTx({ matchId }: { matchId: string }): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: moduleTarget("cancel_match"),
    arguments: [tx.object(registryId()), tx.pure.vector("u8", matchIdBytes(matchId))],
  });
  return tx;
}

export function buildTransferOracleTx({
  matchId,
  newOracle,
}: {
  matchId: string;
  newOracle: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: moduleTarget("transfer_match_oracle"),
    arguments: [
      tx.object(registryId()),
      tx.pure.vector("u8", matchIdBytes(matchId)),
      tx.pure.address(newOracle),
    ],
  });
  return tx;
}

export function buildDepositLiquidityTx({ amountMist }: { amountMist: bigint }): Transaction {
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
  tx.moveCall({
    target: moduleTarget("deposit_liquidity"),
    arguments: [tx.object(registryId()), payment],
  });
  return tx;
}

// ============================================================
// Server helper: ask the oracle to open the on-chain match
// ============================================================

export async function ensureEscrowMatch(matchIdString: string): Promise<void> {
  if (!isEscrowEnabled()) return;

  const res = await fetch("/api/sui-escrow/ensure-match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchId: matchIdString }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not open on-chain match escrow");
  }
}

// ============================================================
// Client-side send helpers
// ============================================================

export type SignAndExecute = (tx: Transaction) => Promise<{ digest: string }>;

export interface EscrowReceipt {
  digest: string;
  explorerUrl: string;
  amountSui: number;
  escrow: true;
}

export async function sendEscrowWager(
  client: SuiClient,
  sender: string,
  matchIdString: string,
  amountSui: number,
  side: EscrowSide,
  odds: number,
  signAndExecute: SignAndExecute
): Promise<EscrowReceipt> {
  if (!isEscrowEnabled()) {
    throw new Error("Escrow program is not configured");
  }

  await ensureEscrowMatch(matchIdString);

  const tx = buildPlaceWagerTx({
    matchId: matchIdString,
    side,
    oddsBps: oddsToBps(odds),
    amountMist: suiToMist(amountSui),
  });
  tx.setSender(sender);

  const { digest } = await signAndExecute(tx);
  await client.waitForTransaction({ digest });

  return {
    digest,
    explorerUrl: explorerTxUrl(digest),
    amountSui,
    escrow: true,
  };
}

export async function sendClaimPayout(
  client: SuiClient,
  sender: string,
  matchIdString: string,
  signAndExecute: SignAndExecute
): Promise<{ digest: string; explorerUrl: string }> {
  if (!isEscrowEnabled()) {
    throw new Error("Escrow program is not configured");
  }

  const tx = buildClaimPayoutTx({ matchId: matchIdString });
  tx.setSender(sender);

  const { digest } = await signAndExecute(tx);
  await client.waitForTransaction({ digest });

  return { digest, explorerUrl: explorerTxUrl(digest) };
}
