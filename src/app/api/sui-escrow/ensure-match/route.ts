import { NextResponse } from "next/server";
import { buildCreateMatchTx, FEE_BPS, isEscrowEnabled } from "@/lib/escrow-sui/client";
import { matchExistsOnChain } from "@/lib/escrow-sui/account-state";
import { loadOracleKeypair } from "@/lib/server/sui-keys";
import { getSuiClient, TREASURY_WALLET } from "@/lib/sui/network";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isEscrowEnabled()) {
    return NextResponse.json(
      { error: "Escrow program is not configured" },
      { status: 503 }
    );
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

    if (await matchExistsOnChain(client, matchId)) {
      return NextResponse.json({ ok: true, created: false });
    }

    const oracle = loadOracleKeypair();
    const treasury = TREASURY_WALLET || oracle.toSuiAddress();

    const tx = buildCreateMatchTx({ matchId, treasury, feeBps: FEE_BPS });
    tx.setSender(oracle.toSuiAddress());

    const { digest } = await client.signAndExecuteTransaction({
      signer: oracle,
      transaction: tx,
    });
    await client.waitForTransaction({ digest });

    return NextResponse.json({ ok: true, created: true, digest });
  } catch (err) {
    console.error("ensure-match failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create on-chain match";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
