import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  isAdminConfigured,
  verifyAdminSecret,
} from "@/lib/server/admin-auth";

export const runtime = "nodejs";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin is not configured. Set STAKEMATE_ADMIN_SECRET on the server." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as { secret?: string };
  if (!verifyAdminSecret(body.secret?.trim())) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, body.secret!.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}
