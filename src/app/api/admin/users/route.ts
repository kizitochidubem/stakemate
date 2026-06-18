import { NextResponse } from "next/server";
import {
  AdminAuthError,
  assertAdminRequest,
} from "@/lib/server/admin-auth";
import { getGlobalMatchCount } from "@/lib/server/agent-stats";
import {
  getAdminUserSummary,
  listUsersForAdmin,
} from "@/lib/server/users";
import { storageMode } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    await assertAdminRequest();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const [summary, users, matchesPlayed] = await Promise.all([
    getAdminUserSummary(),
    listUsersForAdmin(300),
    getGlobalMatchCount(),
  ]);

  return NextResponse.json({
    summary,
    users,
    platform: {
      matchesPlayed,
      storage: storageMode,
    },
  });
}
