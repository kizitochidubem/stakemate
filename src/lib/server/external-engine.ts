import { Chess, type Move } from "chess.js";

export interface EngineMoveRequest {
  fen: string;
  legalMoves: string[];
  agentId: string;
  matchId: string;
  side: "white" | "black";
}

export interface EngineMoveResponse {
  move?: string;
  san?: string;
  from?: string;
  to?: string;
  promotion?: string;
}

const ENGINE_TIMEOUT_MS = 8_000;

/** POST { fen, legalMoves, ... } → { move | san | from+to } */
export async function fetchMoveFromEngine(
  engineUrl: string,
  payload: EngineMoveRequest
): Promise<Move | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);

  try {
    const res = await fetch(engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const body = (await res.json()) as EngineMoveResponse;
    const game = new Chess(payload.fen);

    if (body.san) {
      const m = game.move(body.san, { strict: false });
      return m ?? null;
    }
    if (body.move) {
      const m = game.move(body.move, { strict: false });
      return m ?? null;
    }
    if (body.from && body.to) {
      const m = game.move({
        from: body.from as `${string}${number}`,
        to: body.to as `${string}${number}`,
        promotion: body.promotion as "q" | "r" | "b" | "n" | undefined,
      });
      return m ?? null;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function parseEngineUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    return u.href.slice(0, 512);
  } catch {
    return undefined;
  }
}
