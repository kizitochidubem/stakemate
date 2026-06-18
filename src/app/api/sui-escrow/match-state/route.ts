import { NextRequest } from "next/server";
import {
  fetchOnChainMatchState,
  fetchOnChainWagerState,
} from "@/lib/escrow-sui/account-state";
import { isEscrowEnabled } from "@/lib/escrow-sui/client";
import { getSuiClient, isValidSuiAddress } from "@/lib/sui/network";
import { jsonError, jsonOk, handleRouteError } from "@/lib/server/api-error";

export const runtime = "nodejs";

/**
 * GET /api/sui-escrow/match-state?matchId=&wallet=
 */
export async function GET(req: NextRequest) {
  if (!isEscrowEnabled()) {
    return jsonError("Escrow is not configured", 503);
  }

  const matchId = req.nextUrl.searchParams.get("matchId")?.trim();
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();

  if (!matchId) {
    return jsonError("matchId is required", 400);
  }

  try {
    const client = getSuiClient();
    const match = await fetchOnChainMatchState(client, matchId);

    let wager: Awaited<ReturnType<typeof fetchOnChainWagerState>> | null =
      null;
    if (wallet) {
      if (!isValidSuiAddress(wallet)) {
        return jsonError("Invalid wallet address", 400);
      }
      wager = await fetchOnChainWagerState(client, matchId, wallet);
    }

    const canSettle = match.status === "open";
    // Both Settled and Cancelled make the wager claimable on-chain.
    // Cancelled = full stake refund, Settled = win/draw/loss per match.winner.
    const claimableStatus =
      match.status === "settled" || match.status === "cancelled";
    const canClaim =
      claimableStatus && wager?.exists === true && !wager.claimed;

    return jsonOk({
      match,
      wager,
      canSettle,
      canClaim,
      alreadyClaimed: wager?.claimed === true,
    });
  } catch (err) {
    return handleRouteError("sui-escrow/match-state", err);
  }
}
