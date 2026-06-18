import { NextResponse } from "next/server";
import { isAdminConfigured, isAdminSession } from "@/lib/server/admin-auth";
import { storageMode } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function GET() {
  const configured = isAdminConfigured();
  const authenticated = configured ? await isAdminSession() : false;
  return NextResponse.json({
    configured,
    authenticated,
    storage: storageMode,
  });
}
