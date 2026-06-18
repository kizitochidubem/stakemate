import { NextResponse } from "next/server";
import { recordUserSettlement } from "@/lib/server/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      wallet?: string;
      matchId?: string;
      outcome?: "won" | "lost" | "refund";
    };

    if (
      !body.wallet ||
      !body.matchId ||
      (body.outcome !== "won" &&
        body.outcome !== "lost" &&
        body.outcome !== "refund")
    ) {
      return NextResponse.json({ error: "Invalid settle payload" }, { status: 400 });
    }

    await recordUserSettlement(body.wallet, body.matchId, body.outcome);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Settle failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
