/**
 * Wager dispatcher.
 *
 * Routes to one of two execution paths based on whether the Stakemate
 * escrow Move package is configured:
 *
 *   1. ESCROW MODE (production)  - NEXT_PUBLIC_SUI_ESCROW_PACKAGE_ID is set
 *      Wager funds are locked in the shared Registry object. Settlement is
 *      trustless. Winner pulls via claim_payout.
 *
 *   2. TREASURY MODE (MVP)       - escrow package not configured
 *      Plain SUI transfer to a treasury wallet.
 *      Settlement is manual / off-chain. Useful for dev + demo.
 */

import type { SuiClient } from "@/lib/sui/network";
import { Transaction } from "@mysten/sui/transactions";
import { TREASURY_WALLET, explorerTxUrl } from "@/lib/sui/network";
import { isEscrowEnabled, sendEscrowWager, suiToMist, type EscrowSide, type SignAndExecute } from "./escrow-sui/client";

export interface WagerReceipt {
  digest: string;
  explorerUrl: string;
  amountSui: number;
  /** True when the wager went through the Stakemate escrow Move package. */
  escrow?: boolean;
}

/**
 * Place a wager. Uses the Stakemate escrow Move package when configured,
 * falls back to direct treasury transfer otherwise.
 */
export async function sendWager(
  client: SuiClient,
  payer: string,
  amountSui: number,
  signAndExecute: SignAndExecute,
  matchId?: string,
  side?: EscrowSide,
  odds?: number
): Promise<WagerReceipt> {
  if (amountSui <= 0) throw new Error("Amount must be positive");

  // Use the escrow Move package when configured + match context is provided
  if (isEscrowEnabled() && matchId && side && odds != null) {
    return sendEscrowWager(client, payer, matchId, amountSui, side, odds, signAndExecute);
  }

  // Fallback: direct transfer to the treasury wallet
  return sendDirectTreasuryWager(client, payer, amountSui, signAndExecute);
}

async function sendDirectTreasuryWager(
  client: SuiClient,
  payer: string,
  amountSui: number,
  signAndExecute: SignAndExecute
): Promise<WagerReceipt> {
  if (!TREASURY_WALLET) {
    throw new Error("Treasury wallet is not configured");
  }

  if (payer.toLowerCase() === TREASURY_WALLET.toLowerCase()) {
    throw new Error(
      "This is the treasury wallet, wagers would just send SUI to yourself. Connect a different wallet to bet for real."
    );
  }

  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(suiToMist(amountSui))]);
  tx.transferObjects([payment], tx.pure.address(TREASURY_WALLET));
  tx.setSender(payer);

  const { digest } = await signAndExecute(tx);
  await client.waitForTransaction({ digest });

  return {
    digest,
    explorerUrl: explorerTxUrl(digest),
    amountSui,
  };
}
