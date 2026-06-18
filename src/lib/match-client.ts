import { fetchJson } from "./fetch-json";

export interface StartMatchResponse {
  id: string;
  fen: string;
  status: "live" | "finished";
  whiteAgent: { id: string; name: string };
  blackAgent: { id: string; name: string };
}

export type EndReason =
  | "checkmate"
  | "stalemate"
  | "threefold"
  | "fifty-move"
  | "insufficient"
  | "move-cap";

export interface MoveResponse {
  id: string;
  fen: string;
  move: string | null;
  from?: string;
  to?: string;
  captured?: string | null;
  isCheck?: boolean;
  evaluation?: number;
  status: "live" | "finished";
  result: "white" | "black" | "draw" | null;
  reason?: EndReason | null;
  gameOver: boolean;
  moveCount?: number;
  agent?: { id: string; name: string };
}

export async function startMatch(
  whiteId: string,
  blackId: string,
  matchId?: string
): Promise<StartMatchResponse> {
  return fetchJson<StartMatchResponse>("/api/match/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ whiteId, blackId, matchId }),
    timeoutMs: 20_000,
  });
}

export async function nextMove(matchId: string): Promise<MoveResponse> {
  return fetchJson<MoveResponse>(`/api/match/${matchId}/move`, {
    method: "POST",
    timeoutMs: 30_000,
  });
}
