import { NextRequest, NextResponse } from "next/server";
import { getArchivedMatch } from "@/lib/server/matches";

/**
 * GET /api/match/[id]
 *
 * Returns full match state. Checks active matches first, then falls back
 * to the archive (Upstash) for finished matches that were cleaned out
 * of process memory.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const match = await getArchivedMatch(id);

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: match.id,
    fen: match.fen,
    moves: match.moves,
    status: match.status,
    result: match.result,
    whiteAgent: {
      id: match.whiteAgent.id,
      name: match.whiteAgent.name,
      elo: match.whiteAgent.elo,
      style: match.whiteAgent.style,
    },
    blackAgent: {
      id: match.blackAgent.id,
      name: match.blackAgent.name,
      elo: match.blackAgent.elo,
      style: match.blackAgent.style,
    },
    moveCount: match.moves.length,
    createdAt: match.createdAt,
    finishedAt: match.finishedAt ?? null,
  });
}
