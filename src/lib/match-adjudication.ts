import type { Chess } from "chess.js";
import { getEvaluation } from "@/lib/server/engine";

export function whiteCentipawns(game: Chess): number {
  return Math.round(getEvaluation(game) * 100);
}

export function adjudicateAtMoveCap(
  game: Chess,
  thresholdCp = 80
): "white" | "black" | "draw" {
  const cp = whiteCentipawns(game);
  if (cp >= thresholdCp) return "white";
  if (cp <= -thresholdCp) return "black";
  if (Math.abs(cp) < 25) {
    return Math.random() < 0.5 ? "white" : "black";
  }
  return cp > 0 ? "white" : "black";
}
