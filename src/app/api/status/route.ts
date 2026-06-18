import { NextResponse } from "next/server";
import { storageMode } from "@/lib/server/storage";
import { listActiveMatches } from "@/lib/server/matches";
import { PLATFORM_AGENTS } from "@/lib/agents";

/**
 * GET /api/status
 *
 * Returns operational status: which storage backend is in use,
 * how many custom agents exist, how many matches are live.
 *
 * Useful for verifying that Upstash Redis is wired up correctly
 * after a Vercel deploy. If storageMode is "memory", deployments
 * won't survive a serverless cold start.
 */
export async function GET() {
  const activeMatches = await listActiveMatches();

  return NextResponse.json({
    status: "ok",
    storage: storageMode,
    persistent: storageMode === "upstash",
    agents: {
      platform: PLATFORM_AGENTS.length,
      total: PLATFORM_AGENTS.length,
    },
    activeMatches: activeMatches.length,
    network: process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet",
    timestamp: Date.now(),
  });
}
