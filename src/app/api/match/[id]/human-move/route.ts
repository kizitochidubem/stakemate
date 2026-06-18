import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getMatch, updateMatch } from "@/lib/server/matches";
import { getAgentMove, getEvaluation } from "@/lib/server/engine";

/**
 * POST /api/match/[id]/human-move
 *
 * Body: { from, to, promotion? }
 *
 * Validates the human's move, applies it, then runs the agent's
 * response in the same request so the client gets both back at once.
 * The match's "white agent" is treated as the human's seat - clients
 * should create the match with human={true, side: "white"} (or black),
 * stored in a tag on the server side. For the MVP we simply detect
 * whose turn it is and run the engine for whichever side is not the
 * human side, which is encoded in the match's tag prefix "human-vs-".
 */

const MOVE_CAP_PLY = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { from, to, promotion } = body as {
    from?: string;
    to?: string;
    promotion?: string;
  };

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to are required" },
      { status: 400 }
    );
  }

  const match = await getMatch(id);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "finished") {
    return NextResponse.json({ error: "Match already finished" }, { status: 400 });
  }

  // Detect the human side from the match metadata. We tag the agent.id
  // with "human" for the human seat when creating these matches via
  // /api/match/start-human.
  const humanIsWhite = match.whiteAgent.id === "human";
  const humanColor = humanIsWhite ? "w" : "b";

  const game = new Chess(match.fen);
  if (game.turn() !== humanColor) {
    return NextResponse.json(
      { error: "Not your turn" },
      { status: 400 }
    );
  }

  // Apply the human's move - validates legality
  let humanMove;
  try {
    humanMove = game.move({ from, to, promotion: promotion ?? "q" });
  } catch {
    return NextResponse.json({ error: "Illegal move" }, { status: 400 });
  }
  if (!humanMove) {
    return NextResponse.json({ error: "Illegal move" }, { status: 400 });
  }

  const newMoves = [...match.moves, humanMove.san];

  // Check end conditions after human move
  if (game.isGameOver() || newMoves.length >= MOVE_CAP_PLY) {
    const result = endResult(game, newMoves.length >= MOVE_CAP_PLY, humanIsWhite);
    await updateMatch(id, {
      fen: game.fen(),
      moves: newMoves,
      status: "finished",
      result: result.result,
    });
    return NextResponse.json({
      id,
      fen: game.fen(),
      humanMove: humanMove.san,
      agentMove: null,
      status: "finished",
      result: result.result,
      reason: result.reason,
      gameOver: true,
      moveCount: newMoves.length,
    });
  }

  // Now the agent moves
  const agent = humanIsWhite ? match.blackAgent : match.whiteAgent;
  const agentMove = getAgentMove(game, agent.elo, agent.personality);
  if (!agentMove) {
    return NextResponse.json({ error: "Agent has no legal moves" }, { status: 500 });
  }
  game.move(agentMove);
  const finalMoves = [...newMoves, agentMove.san];

  const isOver = game.isGameOver() || finalMoves.length >= MOVE_CAP_PLY;
  const result = isOver ? endResult(game, finalMoves.length >= MOVE_CAP_PLY, humanIsWhite) : null;

  await updateMatch(id, {
    fen: game.fen(),
    moves: finalMoves,
    status: isOver ? "finished" : "live",
    result: result?.result ?? null,
  });

  return NextResponse.json({
    id,
    fen: game.fen(),
    humanMove: humanMove.san,
    humanFrom: humanMove.from,
    humanTo: humanMove.to,
    humanCaptured: humanMove.captured ?? null,
    agentMove: agentMove.san,
    agentFrom: agentMove.from,
    agentTo: agentMove.to,
    agentCaptured: agentMove.captured ?? null,
    isCheck: game.isCheck(),
    evaluation: getEvaluation(game),
    status: isOver ? "finished" : "live",
    result: result?.result ?? null,
    reason: result?.reason ?? null,
    gameOver: isOver,
    moveCount: finalMoves.length,
  });
}

function endResult(
  game: Chess,
  hitCap: boolean,
  _humanIsWhite: boolean
): {
  result: "white" | "black" | "draw";
  reason: "checkmate" | "stalemate" | "threefold" | "insufficient" | "move-cap";
} {
  if (game.isCheckmate()) {
    return {
      result: game.turn() === "w" ? "black" : "white",
      reason: "checkmate",
    };
  }
  if (game.isThreefoldRepetition()) return { result: "draw", reason: "threefold" };
  if (game.isInsufficientMaterial()) return { result: "draw", reason: "insufficient" };
  if (hitCap) return { result: "draw", reason: "move-cap" };
  return { result: "draw", reason: "stalemate" };
}
