import { NextResponse } from "next/server";
import { recordUserWager } from "@/lib/server/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      wallet?: string;
      signature?: string;
      matchId?: string;
      amount?: number;
      side?: "white" | "black";
      agentName?: string;
    };

    if (
      !body.wallet ||
      !body.signature ||
      !body.matchId ||
      typeof body.amount !== "number" ||
      (body.side !== "white" && body.side !== "black") ||
      !body.agentName
    ) {
      return NextResponse.json({ error: "Invalid wager payload" }, { status: 400 });
    }

    await recordUserWager(body.wallet, {
      signature: body.signature,
      matchId: body.matchId,
      amount: body.amount,
      side: body.side,
      agentName: body.agentName,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Record failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
