import { NextRequest, NextResponse } from "next/server";
import { createMatch, type ServerAgent } from "@/lib/server/matches";
import { getAgentWithStats } from "@/lib/server/agent-stats";
import type { Personality } from "@/lib/server/engine";

async function resolveAgent(id: string): Promise<ServerAgent | null> {
  const platform = await getAgentWithStats(id);
  if (platform) {
    return {
      id: platform.id,
      name: platform.name,
      elo: platform.elo,
      style: platform.style,
      personality: platform.personality as Personality,
      depth: platform.depth,
      source: "platform",
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { whiteId, blackId, matchId: clientMatchId } = body;

    if (!whiteId || !blackId) {
      return NextResponse.json(
        { error: "whiteId and blackId are required" },
        { status: 400 }
      );
    }

    const [white, black] = await Promise.all([
      resolveAgent(whiteId),
      resolveAgent(blackId),
    ]);

    if (!white || !black) {
      return NextResponse.json(
        { error: "Invalid agent IDs" },
        { status: 400 }
      );
    }

    const match = await createMatch(
      white,
      black,
      typeof clientMatchId === "string" ? clientMatchId : undefined
    );

    return NextResponse.json({
      id: match.id,
      fen: match.fen,
      status: match.status,
      whiteAgent: { id: match.whiteAgent.id, name: match.whiteAgent.name },
      blackAgent: { id: match.blackAgent.id, name: match.blackAgent.name },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
