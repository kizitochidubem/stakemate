import { NextResponse } from "next/server";
import { buildSettleMatchTx, isEscrowEnabled, type EscrowOutcome } from "@/lib/escrow-sui/client";
import { matchExistsOnChain } from "@/lib/escrow-sui/account-state";
import { loadOracleKeypair } from "@/lib/server/sui-keys";
import { getSuiClient } from "@/lib/sui/network";
import { attachSettleDigest } from "@/lib/server/matches";

export const runtime = "nodejs";

function parseOutcome(value: unknown): EscrowOutcome | null {
  if (value === "draw" || value === "white" || value === "black") return value;
  return null;
}

export async function POST(request: Request) {
  if (!isEscrowEnabled()) {
    return NextResponse.json(
      { error: "Escrow program is not configured" },
      { status: 503 }
    );
  }

  let matchId: string;
  let outcome: EscrowOutcome;
  try {
    const body = (await request.json()) as {
      matchId?: string;
      outcome?: unknown;
    };
    if (!body.matchId || typeof body.matchId !== "string") {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }
    const parsed = parseOutcome(body.outcome);
    if (!parsed) {
      return NextResponse.json(
        { error: "outcome must be draw, white, or black" },
        { status: 400 }
      );
    }
    matchId = body.matchId;
    outcome = parsed;
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
    const tx = buildSettleMatchTx({ matchId, winner: outcome });
    tx.setSender(oracle.toSuiAddress());

    const { digest } = await client.signAndExecuteTransaction({
      signer: oracle,
      transaction: tx,
    });
    await client.waitForTransaction({ digest });
    void attachSettleDigest(matchId, digest).catch((err) => {
      console.error("attachSettleDigest failed:", err);
    });

    return NextResponse.json({ ok: true, outcome, digest });
  } catch (err) {
    console.error("settle-match failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to settle on-chain match";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
