import { NextResponse } from "next/server";
import { checkUpstashReachable, storageMode } from "@/lib/server/storage";

export const runtime = "nodejs";

/**
 * GET /api/health · liveness + dependency checks for Render/Vercel monitors.
 */
export async function GET() {
  const checks: Record<string, boolean> = {
    kv: await checkUpstashReachable(),
  };

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
