/**
 * Lightweight commentary lines triggered by match events.
 * Surfaces only impactful moments · captures, checks, swings,
 * end states · so the timeline doesn't drown in toasts.
 */

const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const CAPTURE_LINES = [
  (mover: string, victim: string) => `${mover} takes the ${victim}.`,
  (mover: string, victim: string) => `${mover} bags a ${victim}.`,
  (mover: string, victim: string) => `${mover} grabs the ${victim}.`,
];

const CHECK_LINES = [
  (mover: string, opp: string) => `${mover} checks ${opp}.`,
  (mover: string, opp: string) => `${opp} is in trouble.`,
  (mover: string) => `${mover} puts the pressure on.`,
];

const SWING_LINES = [
  (leader: string) => `${leader} is taking control.`,
  (leader: string) => `Momentum shifts to ${leader}.`,
  (leader: string) => `${leader} smells blood.`,
];

const MATE_LINES = [
  (winner: string, loser: string) => `${winner} checkmates ${loser}.`,
  (winner: string, loser: string) => `${winner} seals the win.`,
  (winner: string) => `${winner} closes it out.`,
];

const DRAW_REASONS: Record<string, string> = {
  threefold: "Threefold repetition · draw.",
  "fifty-move": "Fifty-move rule · draw.",
  insufficient: "Insufficient material · draw.",
  stalemate: "Stalemate · draw.",
  "move-cap": "Move cap reached · draw.",
};

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function captureLine(moverName: string, capturedPiece: string): string {
  const victim = PIECE_NAMES[capturedPiece.toLowerCase()] ?? "piece";
  return pick(CAPTURE_LINES)(moverName, victim);
}

export function checkLine(moverName: string, opponentName: string): string {
  return pick(CHECK_LINES)(moverName, opponentName);
}

export function swingLine(leaderName: string): string {
  return pick(SWING_LINES)(leaderName);
}

export function mateLine(winnerName: string, loserName: string): string {
  return pick(MATE_LINES)(winnerName, loserName);
}

export function drawLine(reason: string | null | undefined): string {
  if (!reason) return "Draw.";
  return DRAW_REASONS[reason] ?? "Draw.";
}
