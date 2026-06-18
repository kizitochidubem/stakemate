/**
 * Read-only on-chain state for the Stakemate escrow Move package.
 *
 * Calls the `match_exists` / `match_info` / `has_wager` / `wager_info`
 * read-only functions via `devInspectTransactionBlock` (no gas, no
 * signature) and decodes the BCS return values.
 */

import { bcs } from "@mysten/sui/bcs";
import type { SuiClient } from "@/lib/sui/network";
import { Transaction } from "@mysten/sui/transactions";
import { ESCROW_PACKAGE_ID, ESCROW_REGISTRY_ID, isEscrowEnabled, matchIdBytes, type EscrowOutcome } from "./client";

export type OnChainMatchStatus = "missing" | "open" | "settled" | "cancelled";

export interface OnChainMatchState {
  status: OnChainMatchStatus;
  winner?: EscrowOutcome;
}

export interface OnChainWagerState {
  exists: boolean;
  claimed: boolean;
  amountMist: number;
  side: "white" | "black";
}

const STATUS_BY_BYTE: OnChainMatchStatus[] = ["open", "settled", "cancelled"];
const OUTCOME_BY_BYTE: EscrowOutcome[] = ["draw", "white", "black"];

function target(fn: string): `${string}::${string}::${string}` {
  return `${ESCROW_PACKAGE_ID}::escrow::${fn}`;
}

async function devInspectReturnValues(
  client: SuiClient,
  sender: string,
  tx: Transaction
): Promise<[number[], string][] | null> {
  try {
    const res = await client.devInspectTransactionBlock({ sender, transactionBlock: tx });
    if (res.error) return null;
    return res.results?.[0]?.returnValues ?? null;
  } catch {
    return null;
  }
}

function parseU8(value: [number[], string]): number {
  return bcs.u8().parse(Uint8Array.from(value[0]));
}

function parseU64(value: [number[], string]): number {
  return Number(bcs.u64().parse(Uint8Array.from(value[0])));
}

function parseBool(value: [number[], string]): boolean {
  return bcs.bool().parse(Uint8Array.from(value[0]));
}

/** A no-op "view" address used as the sender for `devInspectTransactionBlock` reads. */
const READ_SENDER = "0x" + "0".repeat(64);

export async function matchExistsOnChain(client: SuiClient, matchId: string): Promise<boolean> {
  if (!isEscrowEnabled()) return false;

  const tx = new Transaction();
  tx.moveCall({
    target: target("match_exists"),
    arguments: [tx.object(ESCROW_REGISTRY_ID as string), tx.pure.vector("u8", matchIdBytes(matchId))],
  });

  const values = await devInspectReturnValues(client, READ_SENDER, tx);
  if (!values?.[0]) return false;
  return parseBool(values[0]);
}

export async function fetchOnChainMatchState(client: SuiClient, matchId: string): Promise<OnChainMatchState> {
  if (!isEscrowEnabled()) return { status: "missing" };
  if (!(await matchExistsOnChain(client, matchId))) return { status: "missing" };

  const tx = new Transaction();
  tx.moveCall({
    target: target("match_info"),
    arguments: [tx.object(ESCROW_REGISTRY_ID as string), tx.pure.vector("u8", matchIdBytes(matchId))],
  });

  const values = await devInspectReturnValues(client, READ_SENDER, tx);
  // match_info returns (oracle, treasury, fee_bps, status, winner, total_white, total_black, fee_collected, balance)
  if (!values || values.length < 5) return { status: "missing" };

  const statusByte = parseU8(values[3]);
  const winnerByte = parseU8(values[4]);

  return {
    status: STATUS_BY_BYTE[statusByte] ?? "missing",
    winner: OUTCOME_BY_BYTE[winnerByte],
  };
}

export async function fetchOnChainWagerState(
  client: SuiClient,
  matchId: string,
  wallet: string
): Promise<OnChainWagerState> {
  const missing: OnChainWagerState = { exists: false, claimed: false, amountMist: 0, side: "white" };
  if (!isEscrowEnabled()) return missing;
  if (!(await matchExistsOnChain(client, matchId))) return missing;

  const hasTx = new Transaction();
  hasTx.moveCall({
    target: target("has_wager"),
    arguments: [
      hasTx.object(ESCROW_REGISTRY_ID as string),
      hasTx.pure.vector("u8", matchIdBytes(matchId)),
      hasTx.pure.address(wallet),
    ],
  });

  const hasValues = await devInspectReturnValues(client, READ_SENDER, hasTx);
  if (!hasValues?.[0] || !parseBool(hasValues[0])) return missing;

  const infoTx = new Transaction();
  infoTx.moveCall({
    target: target("wager_info"),
    arguments: [
      infoTx.object(ESCROW_REGISTRY_ID as string),
      infoTx.pure.vector("u8", matchIdBytes(matchId)),
      infoTx.pure.address(wallet),
    ],
  });

  const values = await devInspectReturnValues(client, READ_SENDER, infoTx);
  // wager_info returns (amount, side, odds_bps, claimed)
  if (!values || values.length < 4) return missing;

  return {
    exists: true,
    amountMist: parseU64(values[0]),
    side: parseU8(values[1]) === 0 ? "white" : "black",
    claimed: parseBool(values[3]),
  };
}

export async function fetchLiquidityValue(client: SuiClient): Promise<number> {
  if (!isEscrowEnabled()) return 0;

  const tx = new Transaction();
  tx.moveCall({
    target: target("liquidity_value"),
    arguments: [tx.object(ESCROW_REGISTRY_ID as string)],
  });

  const values = await devInspectReturnValues(client, READ_SENDER, tx);
  if (!values?.[0]) return 0;
  return parseU64(values[0]);
}
