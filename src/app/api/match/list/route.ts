import { NextResponse } from "next/server";
import { listActiveMatches } from "@/lib/server/matches";

/**
 * GET /api/match/list
 *
 * Returns active matches for the spectate page.
 * Empty array if no one's playing right now.
 */
export async function GET() {
  const matches = await listActiveMatches();
  return NextResponse.json({
    matches: matches.map((m) => ({
      id: m.id,
      whiteAgent: { id: m.whiteAgent.id, name: m.whiteAgent.name },
      blackAgent: { id: m.blackAgent.id, name: m.blackAgent.name },
      moveCount: m.moves.length,
      status: m.status,
      startedAt: m.createdAt,
    })),
    total: matches.length,
  });
}
