import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { createMatch, updateMatch, type ServerAgent } from "@/lib/server/matches";
import { getAgentWithStats } from "@/lib/server/agent-stats";
import {
  getAgentMove,
  getEvaluation,
  type Personality,
} from "@/lib/server/engine";

/**
 * POST /api/match/start-human
 *
 * Body: { agentId, humanSide: "white" | "black", humanName? }
 */

const HUMAN_AGENT: ServerAgent = {
  id: "human",
  name: "You",
  elo: 1200,
  style: "HUMAN",
  personality: "positional" as Personality,
  depth: 0,
  source: "platform",
};

async function resolveAgent(id: string): Promise<ServerAgent | null> {
  const platform = await getAgentWithStats(id);
  if (platform) {
    return {
      id: platform.id,
      name: platform.name,
      elo: platform.elo,
      style: platform.style,
      personality: platform.personality,
      depth: platform.depth,
      source: "platform",
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, humanSide, humanName } = body as {
      agentId?: string;
      humanSide?: "white" | "black";
      humanName?: string;
    };

    if (!agentId || (humanSide !== "white" && humanSide !== "black")) {
      return NextResponse.json(
        { error: "agentId and humanSide ('white' | 'black') required" },
        { status: 400 }
      );
    }

    const agent = await resolveAgent(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Unknown agent" }, { status: 400 });
    }

    const humanPlayer: ServerAgent = {
      ...HUMAN_AGENT,
      name: humanName?.trim() || "You",
    };

    const white = humanSide === "white" ? humanPlayer : agent;
    const black = humanSide === "black" ? humanPlayer : agent;

    const match = await createMatch(white, black);

    let agentOpener: string | null = null;
    let evaluation = 0;
    if (humanSide === "black") {
      const game = new Chess(match.fen);
      const move = getAgentMove(game, agent.elo, agent.personality);
      if (move) {
        game.move(move);
        agentOpener = move.san;
        evaluation = getEvaluation(game);
        // Persist the agent's first move so subsequent /human-move polls
        // (which may hit a different lambda) see the same board state.
        await updateMatch(match.id, {
          fen: game.fen(),
          moves: [move.san],
        });
        match.fen = game.fen();
        match.moves.push(move.san);
      }
    }

    return NextResponse.json({
      id: match.id,
      fen: match.fen,
      status: "live",
      humanSide,
      agent: { id: agent.id, name: agent.name, elo: agent.elo, style: agent.style },
      agentOpener,
      evaluation,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
