import { NextResponse } from "next/server";
import { kv, storageMode } from "@/lib/server/storage";
import { getGlobalMatchCount } from "@/lib/server/agent-stats";

export const runtime = "nodejs";

/**
 * GET /api/health · liveness + dependency checks for Render/Vercel monitors.
 */
export async function GET() {
  const checks: Record<string, boolean> = {
    kv: false,
  };

  try {
    await getGlobalMatchCount();
    checks.kv = true;
  } catch {
    try {
      await kv.set("__health_ping__", 1);
      await kv.get("__health_ping__");
      checks.kv = true;
    } catch {
      checks.kv = storageMode === "memory";
    }
  }

  const ok = checks.kv;

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      service: "stakemate",
      storage: storageMode,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
