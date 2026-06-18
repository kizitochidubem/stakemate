import { NextRequest } from "next/server";
import {
  fetchOnChainMatchState,
  fetchOnChainWagerState,
} from "@/lib/escrow-sui/account-state";
import { isEscrowEnabled } from "@/lib/escrow-sui/client";
import { getSuiClient, isValidSuiAddress } from "@/lib/sui/network";
import { jsonError, jsonOk, handleRouteError } from "@/lib/server/api-error";
import { getUserWagers } from "@/lib/server/users";

export const runtime = "nodejs";

/**
 * GET /api/sui-escrow/pending-claims?wallet=<address>
 *
 * Returns every wager this wallet has placed that has not yet been
 * claimed on-chain. Each row tells the client whether it's:
 *   - claimable_won      : match settled, you backed the winner
 *   - claimable_draw     : match settled as draw, refund waiting
 *   - claimable_cancelled: match was cancelled, refund waiting
 *   - claimable_recover  : on-chain match is still Open even though
 *                          our server thinks it ended (server may
 *                          have crashed mid-settle). UI offers a
 *                          "Recover" path which settles-as-draw.
 *   - pending            : match still open and live; nothing to do yet
 *   - claimed            : already claimed, just history
 *   - lost               : settled and you backed the loser; nothing
 *                          to claim, but render for accounting
 *   - unknown            : match object missing on-chain (older
 *                          treasury-mode wagers, or pre-escrow)
 *
 * UI uses these states to decide what to render in the Pending
 * Claims card on /wallet.
 */

export type ClaimState =
  | "claimable_won"
  | "claimable_draw"
  | "claimable_cancelled"
  | "claimable_recover"
  | "pending"
  | "claimed"
  | "lost"
  | "unknown";

export interface PendingClaimRow {
  matchId: string;
  agentName: string;
  amount: number;
  side: "white" | "black";
  placedAt: number;
  state: ClaimState;
  /** Server-recorded outcome from the off-chain match (if any). */
  outcome?: "won" | "lost" | "refund";
  /** On-chain match status, when escrow exists. */
  matchStatus?: "open" | "settled" | "cancelled";
  /** Winner side, when match is settled. */
  winner?: "white" | "black" | "draw";
  /** Whether escrow says this wager exists on-chain. */
  onChain: boolean;
}

const MAX_CHECK = 24; // bound on-chain calls per request

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
  if (!wallet) {
    return jsonError("wallet is required", 400);
  }

  if (!isValidSuiAddress(wallet)) {
    return jsonError("Invalid wallet address", 400);
  }

  try {
    const wagers = await getUserWagers(wallet, MAX_CHECK);
    if (wagers.length === 0) {
      return jsonOk({ rows: [], escrowEnabled: isEscrowEnabled() });
    }

    if (!isEscrowEnabled()) {
      // Treasury-mode wagers · no on-chain state to check. Surface them
      // for accounting only.
      const rows: PendingClaimRow[] = wagers.map((w) => ({
        matchId: w.matchId,
        agentName: w.agentName,
        amount: w.amount,
        side: w.side,
        placedAt: w.placedAt,
        state: "unknown",
        outcome: w.outcome,
        onChain: false,
      }));
      return jsonOk({ rows, escrowEnabled: false });
    }

    const client = getSuiClient();

    // Fan out the on-chain reads in parallel (within a small batch).
    const rows = await Promise.all(
      wagers.map(async (w): Promise<PendingClaimRow> => {
        try {
          const [match, wagerState] = await Promise.all([
            fetchOnChainMatchState(client, w.matchId),
            fetchOnChainWagerState(client, w.matchId, wallet),
          ]);

          // No on-chain match: probably a treasury-mode wager from before
          // escrow was wired up.
          if (match.status === "missing") {
            return {
              matchId: w.matchId,
              agentName: w.agentName,
              amount: w.amount,
              side: w.side,
              placedAt: w.placedAt,
              state: "unknown",
              outcome: w.outcome,
              onChain: false,
            };
          }

          // No on-chain wager: user never confirmed the escrow tx,
          // or wager was placed before escrow.
          if (!wagerState.exists) {
            return {
              matchId: w.matchId,
              agentName: w.agentName,
              amount: w.amount,
              side: w.side,
              placedAt: w.placedAt,
              state: "unknown",
              outcome: w.outcome,
              matchStatus: match.status as "open" | "settled" | "cancelled",
              onChain: false,
            };
          }

          // Already claimed on-chain: show as history.
          if (wagerState.claimed) {
            return {
              matchId: w.matchId,
              agentName: w.agentName,
              amount: w.amount,
              side: w.side,
              placedAt: w.placedAt,
              state: "claimed",
              outcome: w.outcome,
              matchStatus: match.status as "open" | "settled" | "cancelled",
              winner: match.winner,
              onChain: true,
            };
          }

          // Match cancelled: refund waiting.
          if (match.status === "cancelled") {
            return {
              matchId: w.matchId,
              agentName: w.agentName,
              amount: w.amount,
              side: w.side,
              placedAt: w.placedAt,
              state: "claimable_cancelled",
              matchStatus: "cancelled",
              onChain: true,
            };
          }

          // Match settled: bucket by outcome relative to user's side.
          if (match.status === "settled") {
            if (match.winner === "draw") {
              return {
                matchId: w.matchId,
                agentName: w.agentName,
                amount: w.amount,
                side: w.side,
                placedAt: w.placedAt,
                state: "claimable_draw",
                matchStatus: "settled",
                winner: "draw",
                onChain: true,
              };
            }
            if (match.winner === w.side) {
              return {
                matchId: w.matchId,
                agentName: w.agentName,
                amount: w.amount,
                side: w.side,
                placedAt: w.placedAt,
                state: "claimable_won",
                matchStatus: "settled",
                winner: match.winner,
                onChain: true,
              };
            }
            return {
              matchId: w.matchId,
              agentName: w.agentName,
              amount: w.amount,
              side: w.side,
              placedAt: w.placedAt,
              state: "lost",
              matchStatus: "settled",
              winner: match.winner,
              onChain: true,
            };
          }

          // Match still open: if our server-side outcome says it's done,
          // surface a recovery option (settle-as-draw). Otherwise just
          // mark pending.
          if (w.outcome) {
            return {
              matchId: w.matchId,
              agentName: w.agentName,
              amount: w.amount,
              side: w.side,
              placedAt: w.placedAt,
              state: "claimable_recover",
              outcome: w.outcome,
              matchStatus: "open",
              onChain: true,
            };
          }

          return {
            matchId: w.matchId,
            agentName: w.agentName,
            amount: w.amount,
            side: w.side,
            placedAt: w.placedAt,
            state: "pending",
            matchStatus: "open",
            onChain: true,
          };
        } catch {
          // Don't fail the whole request because one wager couldn't
          // be checked · surface it as unknown.
          return {
            matchId: w.matchId,
            agentName: w.agentName,
            amount: w.amount,
            side: w.side,
            placedAt: w.placedAt,
            state: "unknown",
            outcome: w.outcome,
            onChain: false,
          };
        }
      })
    );

    return jsonOk({ rows, escrowEnabled: true });
  } catch (err) {
    return handleRouteError("sui-escrow/pending-claims", err);
  }
}
