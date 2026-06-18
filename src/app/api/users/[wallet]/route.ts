import { NextResponse } from "next/server";
import { getUser, getUserWagers } from "@/lib/server/users";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await params;
  const user = await getUser(wallet);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const wagers = await getUserWagers(wallet, 25);
  return NextResponse.json({ user, wagers });
}
