import { Chess, Move, Square } from "chess.js";

export type Personality =
  | "aggressive"
  | "defensive"
  | "chaotic"
  | "positional"
  | "sacrificial"
  | "endgame";

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const PST_BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];

const PST_ROOK = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
];

function squareToIndex(square: Square, isWhite: boolean): number {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  return isWhite ? (7 - rank) * 8 + file : rank * 8 + file;
}

function getPST(type: string): number[] | null {
  switch (type) {
    case "p": return PST_PAWN;
    case "n": return PST_KNIGHT;
    case "b": return PST_BISHOP;
    case "r": return PST_ROOK;
    default: return null;
  }
}

export function evaluateBoard(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === "w" ? -99999 : 99999;
  }
  if (game.isDraw() || game.isStalemate()) return 0;

  let score = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const isWhite = piece.color === "w";
      const value = PIECE_VALUES[piece.type] || 0;
      const sq = (String.fromCharCode(97 + c) + String(8 - r)) as Square;
      const pst = getPST(piece.type);
      const positional = pst ? pst[squareToIndex(sq, isWhite)] : 0;

      score += isWhite ? value + positional : -(value + positional);
    }
  }

  // Mobility bonus
  const currentMoves = game.moves().length;
  score += game.turn() === "w" ? currentMoves * 2 : -currentMoves * 2;

  return score;
}

function applyPersonality(
  move: Move,
  score: number,
  personality: Personality,
  game: Chess
): number {
  let bonus = 0;

  switch (personality) {
    case "aggressive":
      if (move.captured) bonus += 60;
      if (move.flags.includes("k") || move.flags.includes("q")) bonus -= 20;
      if (game.isCheck()) bonus += 40;
      // prefer central attacks
      if (move.to[0] >= "c" && move.to[0] <= "f") bonus += 10;
      break;

    case "defensive":
      if (move.flags.includes("k") || move.flags.includes("q")) bonus += 50;
      if (move.piece === "k") bonus -= 40;
      const rank = parseInt(move.to[1]);
      if (game.turn() === "w" && rank <= 3) bonus += 10;
      if (game.turn() === "b" && rank >= 6) bonus += 10;
      break;

    case "chaotic":
      bonus += (Math.random() - 0.5) * 180;
      if (move.captured) bonus += 25;
      if (game.isCheck()) bonus += 30;
      break;

    case "positional":
      if (move.piece === "p") bonus += 12;
      if (move.piece === "n" || move.piece === "b") bonus += 18;
      if (["d4", "e4", "d5", "e5"].includes(move.to)) bonus += 25;
      if (["c3", "f3", "c6", "f6"].includes(move.to)) bonus += 10;
      break;

    case "sacrificial":
      if (
        move.captured &&
        PIECE_VALUES[move.piece] > PIECE_VALUES[move.captured]
      ) {
        bonus += 80;
      }
      if (move.piece === "q" && move.captured) bonus += 50;
      if (game.isCheck() && move.captured) bonus += 40;
      break;

    case "endgame": {
      const pieces = game.board().flat().filter(Boolean).length;
      if (pieces < 16) {
        bonus += 50;
        if (move.piece === "r" || move.piece === "q") bonus += 25;
        if (move.piece === "k") bonus += 15;
        if (move.piece === "p") bonus += 20;
      }
      break;
    }
  }

  return score + bonus;
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  personality: Personality
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }

  const moves = game.moves({ verbose: true });

  moves.sort((a, b) => {
    const aCapture = a.captured ? PIECE_VALUES[a.captured] || 0 : 0;
    const bCapture = b.captured ? PIECE_VALUES[b.captured] || 0 : 0;
    return bCapture - aCapture;
  });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      let evalScore = minimax(game, depth - 1, alpha, beta, false, personality);
      evalScore = applyPersonality(move, evalScore, personality, game);
      game.undo();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      let evalScore = minimax(game, depth - 1, alpha, beta, true, personality);
      evalScore = applyPersonality(move, -evalScore, personality, game);
      game.undo();
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function getBestMove(
  game: Chess,
  depth: number,
  personality: Personality
): Move | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  const isWhite = game.turn() === "w";
  let bestMove = moves[0];
  let bestScore = isWhite ? -Infinity : Infinity;

  for (const move of moves) {
    game.move(move);
    let score = minimax(
      game,
      depth - 1,
      -Infinity,
      Infinity,
      !isWhite,
      personality
    );
    score = applyPersonality(move, score, personality, game);
    game.undo();

    if (isWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  // Chaotic agents occasionally play random moves
  if (personality === "chaotic" && Math.random() < 0.12) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  return bestMove;
}

function blunderRate(personality: Personality, elo: number): number {
  const byStyle =
    personality === "chaotic"
      ? 0.14
      : personality === "aggressive" || personality === "sacrificial"
        ? 0.09
        : personality === "defensive"
          ? 0.05
          : 0.07;
  const eloFactor = Math.max(0, (2400 - elo) / 4000);
  return Math.min(0.18, byStyle + eloFactor);
}

function pickSuboptimalMove(
  game: Chess,
  personality: Personality
): Move | null {
  const moves = game.moves({ verbose: true });
  if (moves.length <= 1) return moves[0] ?? null;

  const isWhite = game.turn() === "w";
  const scored = moves.map((move) => {
    game.move(move);
    let score = evaluateBoard(game);
    score = applyPersonality(move, score, personality, game);
    game.undo();
    return { move, score };
  });

  scored.sort((a, b) => (isWhite ? b.score - a.score : a.score - b.score));
  const rank = Math.min(
    scored.length - 1,
    2 + Math.floor(Math.random() * Math.min(3, scored.length - 1))
  );
  return scored[rank]?.move ?? scored[0]?.move ?? null;
}

/** Search depth from agent rating (1–3, capped for API latency). */
export function depthForElo(elo: number, personality: Personality): number {
  const base = elo >= 2200 ? 3 : elo >= 1800 ? 2 : 1;
  if (personality === "chaotic") return Math.max(1, base - 1);
  if (personality === "aggressive") return Math.min(3, base + 1);
  return base;
}

export function getAgentMove(
  game: Chess,
  elo: number,
  personality: Personality
): Move | null {
  const depth = depthForElo(elo, personality);
  if (Math.random() < blunderRate(personality, elo)) {
    return pickSuboptimalMove(game, personality) ?? getBestMove(game, depth, personality);
  }
  return getBestMove(game, depth, personality);
}

export function getEvaluation(game: Chess): number {
  const raw = evaluateBoard(game);
  return Math.max(-10, Math.min(10, raw / 100));
}
