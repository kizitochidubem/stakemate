import { Agent } from "./agents";

export interface MatchState {
  id: string;
  whiteAgent: Agent;
  blackAgent: Agent;
  status: "waiting" | "live" | "finished";
  fen: string;
  moves: string[];
  result: "white" | "black" | "draw" | null;
  wagerPool: number;
  spectators: number;
  startedAt: number;
  moveTimestamps: number[];
}

export function createMatch(white: Agent, black: Agent): MatchState {
  return {
    id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    whiteAgent: white,
    blackAgent: black,
    status: "waiting",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    moves: [],
    result: null,
    wagerPool: Math.round((Math.random() * 50 + 5) * 10) / 10,
    spectators: Math.floor(Math.random() * 200 + 20),
    startedAt: Date.now(),
    moveTimestamps: [],
  };
}

export function formatWager(amount: number): string {
  return amount.toFixed(1) + " SUI";
}

// Cap on payout odds. Without this, an ELO gap of 1200 produces
// payouts north of 1000x · mathematically correct but meaningless
// because the underdog basically never wins. Sportsbook UX caps
// implied odds, and so do we.
const MIN_ODDS = 1.05;
const MAX_ODDS = 20;

function clampOdds(raw: number): number {
  if (!Number.isFinite(raw)) return MAX_ODDS;
  return Math.max(MIN_ODDS, Math.min(MAX_ODDS, raw));
}

/**
 * Implied payout multipliers from current ELO (updates as agents win/lose).
 * Capped at 1.05x–20x so extreme rating gaps stay bettable.
 */
export function calculateOdds(white: Agent, black: Agent): { white: number; black: number } {
  const eloDiff = white.elo - black.elo;
  const expectedWhite = 1 / (1 + Math.pow(10, -eloDiff / 400));
  return {
    white: Math.round(clampOdds(1 / expectedWhite) * 100) / 100,
    black: Math.round(clampOdds(1 / (1 - expectedWhite)) * 100) / 100,
  };
}
