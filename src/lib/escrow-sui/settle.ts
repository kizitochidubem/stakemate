/**
 * Escrow settlement:
 *   1. settle_match · oracle only (no wallet popup)
 *   2. claim_payout · user signs when they win or get a draw refund
 */

import type { SuiClient } from "@/lib/sui/network";
import { isEscrowEnabled, sendClaimPayout, type EscrowOutcome, type SignAndExecute } from "./client";
import { friendlyEscrowError } from "./error-messages";

export async function settleEscrowMatch(
  matchId: string,
  outcome: EscrowOutcome
): Promise<{ digest?: string }> {
  if (!isEscrowEnabled()) {
    return {};
  }

  const settleRes = await fetch("/api/sui-escrow/settle-match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchId, outcome }),
  });

  if (!settleRes.ok) {
    const body = (await settleRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      friendlyEscrowError(new Error(body.error ?? "Could not settle match on-chain"))
    );
  }

  return (await settleRes.json()) as { digest?: string };
}

export async function claimEscrowPayout(
  client: SuiClient,
  sender: string,
  matchId: string,
  signAndExecute: SignAndExecute
): Promise<{ digest: string; explorerUrl: string }> {
  return sendClaimPayout(client, sender, matchId, signAndExecute);
}
