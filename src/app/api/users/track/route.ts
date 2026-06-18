import { NextResponse } from "next/server";
import { trackUserVisit } from "@/lib/server/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { wallet?: string };
    if (!body.wallet || typeof body.wallet !== "string") {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }
    const user = await trackUserVisit(body.wallet);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Track failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
