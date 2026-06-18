import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getMatch, updateMatch } from "@/lib/server/matches";
import { getAgentMove, getEvaluation } from "@/lib/server/engine";
import { fetchMoveFromEngine } from "@/lib/server/external-engine";
import { adjudicateAtMoveCap } from "@/lib/match-adjudication";
import { handleRouteError, jsonError } from "@/lib/server/api-error";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/match/[id]/move
 *
 * Computes the next move server-side using the current agent's
 * personality and depth. Returns the new FEN, the move in SAN,
 * and whether the game is over.
 *
 * This is the core difference from the client-side demo:
 * the chess AI runs on the server, not in the browser.
 */

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
  const match = await getMatch(id);

  if (!match) {
    return jsonError("Match not found", 404, "MATCH_NOT_FOUND");
  }

  if (match.status === "finished") {
    return NextResponse.json({
      id: match.id,
      fen: match.fen,
      status: "finished",
      result: match.result,
      move: null,
      gameOver: true,
    });
  }

  const game = new Chess(match.fen);

  // Move cap: after this many plies, adjudicate by eval if no decisive result.
  // Prevents endless draws between equal engines while still allowing checkmates.
  const MOVE_CAP_PLY = 72; // ~36 full moves · keeps spectating snappy
  const reachedCap = match.moves.length >= MOVE_CAP_PLY;

  if (game.isGameOver() || reachedCap) {
    let result: "white" | "black" | "draw" = "draw";
    let reason: "checkmate" | "stalemate" | "threefold" | "fifty-move" | "insufficient" | "move-cap" = "stalemate";
    if (game.isCheckmate()) {
      result = game.turn() === "w" ? "black" : "white";
      reason = "checkmate";
    } else if (game.isThreefoldRepetition()) {
      reason = "threefold";
    } else if (game.isInsufficientMaterial()) {
      reason = "insufficient";
    } else if (reachedCap) {
      result = adjudicateAtMoveCap(game);
      reason = "move-cap";
    }

    await updateMatch(id, {
      status: "finished",
      result,
    });

    return NextResponse.json({
      id: match.id,
      fen: match.fen,
      status: "finished",
      result,
      reason,
      move: null,
      gameOver: true,
    });
  }

  // Determine which agent moves
  const agent =
    game.turn() === "w" ? match.whiteAgent : match.blackAgent;

  let move = null;
  if (agent.engineUrl) {
    const side = game.turn() === "w" ? "white" : "black";
    move = await fetchMoveFromEngine(agent.engineUrl, {
      fen: game.fen(),
      legalMoves: game.moves(),
      agentId: agent.id,
      matchId: id,
      side,
    });
  }
  if (!move) {
    move = getAgentMove(game, agent.elo, agent.personality);
  }

  if (!move) {
    return jsonError("No legal moves", 500, "ENGINE_ERROR");
  }

  // Apply the move
  game.move(move);

  const newMoveCount = match.moves.length + 1;
  const hitCapAfterMove = newMoveCount >= MOVE_CAP_PLY;
  const isOver = game.isGameOver() || hitCapAfterMove;
  let result: "white" | "black" | "draw" | null = null;
  let reason: "checkmate" | "stalemate" | "threefold" | "fifty-move" | "insufficient" | "move-cap" | null = null;

  if (isOver) {
    if (game.isCheckmate()) {
      result = game.turn() === "w" ? "black" : "white";
      reason = "checkmate";
    } else {
      result = "draw";
      if (game.isThreefoldRepetition()) reason = "threefold";
      else if (game.isInsufficientMaterial()) reason = "insufficient";
      else if (hitCapAfterMove) {
        result = adjudicateAtMoveCap(game);
        reason = "move-cap";
      } else reason = "stalemate";
    }
  }

  // Update stored match
  await updateMatch(id, {
    fen: game.fen(),
    moves: [...match.moves, move.san],
    status: isOver ? "finished" : "live",
    result,
  });

  return NextResponse.json({
    id: match.id,
    fen: game.fen(),
    move: move.san,
    from: move.from,
    to: move.to,
    captured: move.captured ?? null,
    isCheck: game.isCheck(),
    evaluation: getEvaluation(game),
    status: isOver ? "finished" : "live",
    result,
    reason,
    gameOver: isOver,
    moveCount: newMoveCount,
    agent: { id: agent.id, name: agent.name, engine: agent.engineUrl ? "external" : "builtin" },
  });
  } catch (err) {
    return handleRouteError(`match/${id}/move`, err);
  }
}
