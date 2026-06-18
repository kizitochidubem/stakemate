import { NextResponse } from "next/server";
import { AGENT_PROFILES } from "@/lib/agents";
import { getGlobalMatchCount } from "@/lib/server/agent-stats";

export const runtime = "nodejs";

export async function GET() {
  const matchesPlayed = await getGlobalMatchCount();

  return NextResponse.json({
    platformAgents: AGENT_PROFILES.length,
    matchesPlayed,
  });
}
