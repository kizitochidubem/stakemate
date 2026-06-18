import { NextResponse } from "next/server";
import { buildCancelMatchTx, isEscrowEnabled } from "@/lib/escrow-sui/client";
import { matchExistsOnChain } from "@/lib/escrow-sui/account-state";
import { loadOracleKeypair } from "@/lib/server/sui-keys";
import { getSuiClient } from "@/lib/sui/network";

export const runtime = "nodejs";

/**
 * POST /api/sui-escrow/cancel-match
 *
 * Server-only: oracle marks an on-chain match Cancelled. All wagers
 * then become refundable via claim_payout (the same endpoint users
 * already use for wins/draws · the package treats Cancelled and Draw
 * payouts identically: stake back at face value).
 *
 * Use cases:
 *   - Off-chain match crashed or got stuck and the oracle never
 *     reported a winner. Users would otherwise have funds locked.
 *   - Server detected a clearly broken state (illegal move chain,
 *     impossible position, etc.) and wants to refund all wagers.
 *   - Oracle is rotating to a new key and wants to clear the open
 *     match before handing off.
 *
 * Auth: requires a valid STAKEMATE_ADMIN_SECRET env var (same one
 * the admin panel uses). No client-side calls; only invoked from
 * internal admin tools.
 */

export async function POST(request: Request) {
  if (!isEscrowEnabled()) {
    return NextResponse.json(
      { error: "Escrow program is not configured" },
      { status: 503 }
    );
  }

  const adminToken = process.env.STAKEMATE_ADMIN_SECRET;
  if (adminToken) {
    const provided = request.headers.get("x-admin-token");
    if (provided !== adminToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let matchId: string;
  try {
    const body = (await request.json()) as { matchId?: string };
    if (!body.matchId || typeof body.matchId !== "string") {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }
    matchId = body.matchId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const client = getSuiClient();

    if (!(await matchExistsOnChain(client, matchId))) {
      return NextResponse.json(
        { error: "On-chain match not found for this id" },
        { status: 404 }
      );
    }

    const oracle = loadOracleKeypair();
    const tx = buildCancelMatchTx({ matchId });
    tx.setSender(oracle.toSuiAddress());

    const { digest } = await client.signAndExecuteTransaction({
      signer: oracle,
      transaction: tx,
    });
    await client.waitForTransaction({ digest });

    return NextResponse.json({ ok: true, cancelled: true, digest });
  } catch (err) {
    console.error("cancel-match failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to cancel on-chain match";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
