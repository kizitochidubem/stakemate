import { fetchOnChainMatchState } from "@/lib/escrow-sui/account-state";
import { friendlyEscrowError } from "@/lib/escrow-sui/error-messages";
import { buildSettleMatchTx, isEscrowEnabled } from "@/lib/escrow-sui/client";
import { loadOracleKeypair } from "@/lib/server/sui-keys";
import { getSuiClient } from "@/lib/sui/network";
import { jsonError, jsonOk } from "@/lib/server/api-error";

export const runtime = "nodejs";

/**
 * Settle a stuck open match as a draw (refresh / server loss).
 * If already settled or cancelled, returns success without re-settling.
 */
export async function POST(request: Request) {
  if (!isEscrowEnabled()) {
    return jsonError("Escrow program is not configured", 503);
  }

  let matchId: string;
  try {
    const body = (await request.json()) as { matchId?: string };
    if (!body.matchId || typeof body.matchId !== "string") {
      return jsonError("matchId is required", 400);
    }
    matchId = body.matchId;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  try {
    const client = getSuiClient();
    const onChain = await fetchOnChainMatchState(client, matchId);

    if (onChain.status === "missing") {
      return jsonError(
        "No on-chain escrow found for this match. Your wager may not have used escrow.",
        404,
        "ESCROW_NOT_FOUND"
      );
    }

    if (onChain.status === "settled") {
      return jsonOk({
        ok: true,
        alreadySettled: true,
        outcome: onChain.winner ?? "draw",
        message: "Match already settled · claim your payout from your wallet.",
      });
    }

    if (onChain.status === "cancelled") {
      return jsonOk({
        ok: true,
        alreadySettled: true,
        cancelled: true,
        outcome: "draw" as const,
        message:
          "Match was cancelled · claim your full refund from your wallet.",
      });
    }

    const oracle = loadOracleKeypair();
    const tx = buildSettleMatchTx({ matchId, winner: "draw" });
    tx.setSender(oracle.toSuiAddress());

    const { digest } = await client.signAndExecuteTransaction({
      signer: oracle,
      transaction: tx,
    });
    await client.waitForTransaction({ digest });

    return jsonOk({
      ok: true,
      alreadySettled: false,
      outcome: "draw",
      digest,
    });
  } catch (err) {
    console.error("recover-wager failed:", err);
    return jsonError(friendlyEscrowError(err), 500, "RECOVER_FAILED");
  }
}
