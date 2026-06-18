import { NextResponse } from "next/server";
import { buildTransferOracleTx, isEscrowEnabled } from "@/lib/escrow-sui/client";
import { matchExistsOnChain } from "@/lib/escrow-sui/account-state";
import { loadOracleKeypair } from "@/lib/server/sui-keys";
import { getSuiClient, isValidSuiAddress } from "@/lib/sui/network";

export const runtime = "nodejs";

/**
 * POST /api/sui-escrow/transfer-oracle
 *
 * Server-only: rotates the on-chain oracle for a match to a new address.
 * Used when:
 *   - Server keypair is rotating and the new key needs to take over
 *     the open matches the old one was responsible for.
 *   - Migrating a high-value match to a multisig oracle for higher trust.
 *
 * Auth: requires the current oracle's private key + the admin token.
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
  let newOracle: string;
  try {
    const body = (await request.json()) as {
      matchId?: string;
      newOracle?: string;
    };
    if (!body.matchId || typeof body.matchId !== "string") {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }
    if (!body.newOracle || !isValidSuiAddress(body.newOracle)) {
      return NextResponse.json(
        { error: "newOracle must be a valid Sui address (0x + 64 hex chars)" },
        { status: 400 }
      );
    }
    matchId = body.matchId;
    newOracle = body.newOracle;
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
    const tx = buildTransferOracleTx({ matchId, newOracle });
    tx.setSender(oracle.toSuiAddress());

    const { digest } = await client.signAndExecuteTransaction({
      signer: oracle,
      transaction: tx,
    });
    await client.waitForTransaction({ digest });

    return NextResponse.json({
      ok: true,
      previousOracle: oracle.toSuiAddress(),
      newOracle,
      digest,
    });
  } catch (err) {
    console.error("transfer-oracle failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to transfer oracle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
