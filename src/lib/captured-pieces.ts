import { Chess } from "chess.js";

/** Pieces captured BY white (i.e. black pieces taken). */
export function getCapturedByWhite(game: Chess): string[] {
  return extractCaptured(game, "w");
}

/** Pieces captured BY black (i.e. white pieces taken). */
export function getCapturedByBlack(game: Chess): string[] {
  return extractCaptured(game, "b");
}

function extractCaptured(game: Chess, byColor: "w" | "b"): string[] {
  const history = game.history({ verbose: true });
  const captured: string[] = [];

  for (const move of history) {
    if (move.captured && move.color === byColor) {
      captured.push(move.captured);
    }
  }

  return captured;
}
