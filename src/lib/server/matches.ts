import { Chess } from "chess.js";
import type { Personality } from "./engine";
import { recordFinishedMatchIfNeeded } from "./agent-stats";
import { kv } from "./storage";

export interface ServerAgent {
  id: string;
  name: string;
  elo: number;
  style: string;
  personality: Personality;
  depth: number;
  source: "platform" | "openclaw";
  engineUrl?: string;
}

export interface ServerMatch {
  id: string;
  whiteAgent: ServerAgent;
  blackAgent: ServerAgent;
  fen: string;
  moves: string[];
  status: "waiting" | "live" | "finished";
  result: "white" | "black" | "draw" | null;
  createdAt: number;
  lastMoveAt: number;
  /** Set when status transitions to "finished" */
  finishedAt?: number;
  /** Sui tx digest for the on-chain settle_match call, when an escrow wager existed */
  settleDigest?: string;
}

// In-process LRU mostly to skip Redis on consecutive polls of the
// same match handled by the same lambda instance. Per-instance only;
// the cross-instance source of truth is Redis.
const cache = new Map<string, ServerMatch>();
const CACHE_MAX = 200;

const ACTIVE_KEY = "match:active";
const ARCHIVE_KEY = (id: string) => `match:archive:${id}`;
const ARCHIVE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const ACTIVE_STALE_MS = 30 * 60 * 1000; // matches go stale after 30 min

function touchCache(match: ServerMatch): void {
  cache.delete(match.id);
  cache.set(match.id, match);
  if (cache.size > CACHE_MAX) {
    const firstKey = cache.keys().next().value as string | undefined;
    if (firstKey) cache.delete(firstKey);
  }
}

function serialize(match: ServerMatch): string {
  return JSON.stringify(match);
}

function deserialize(raw: string): ServerMatch | null {
  try {
    return JSON.parse(raw) as ServerMatch;
  } catch {
    return null;
  }
}

async function persistActive(match: ServerMatch): Promise<void> {
  try {
    await kv.hset(ACTIVE_KEY, match.id, serialize(match));
  } catch (err) {
    console.error("persistActive failed:", err);
  }
}

async function evictActive(id: string): Promise<void> {
  try {
    await kv.hdel(ACTIVE_KEY, id);
  } catch (err) {
    console.error("evictActive failed:", err);
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      void (async () => {
        try {
          const all = await kv.hgetall(ACTIVE_KEY);
          const cutoff = Date.now() - ACTIVE_STALE_MS;
          for (const [id, raw] of Object.entries(all)) {
            const m = deserialize(raw);
            if (!m || m.lastMoveAt < cutoff) {
              await kv.hdel(ACTIVE_KEY, id);
              cache.delete(id);
            }
          }
        } catch (err) {
          console.error("active sweep failed:", err);
        }
      })();
    },
    5 * 60 * 1000
  );
}

export async function createMatch(
  white: ServerAgent,
  black: ServerAgent,
  /** When set (e.g. arena client id), keeps wagers and server match in sync. */
  idOverride?: string
): Promise<ServerMatch> {
  const id =
    idOverride?.trim() ||
    `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const match: ServerMatch = {
    id,
    whiteAgent: white,
    blackAgent: black,
    fen: new Chess().fen(),
    moves: [],
    status: "live",
    result: null,
    createdAt: Date.now(),
    lastMoveAt: Date.now(),
  };
  touchCache(match);
  await persistActive(match);
  return match;
}

export async function getMatch(id: string): Promise<ServerMatch | undefined> {
  const cached = cache.get(id);
  if (cached) {
    touchCache(cached);
    return cached;
  }
  try {
    const raw = await kv.hget(ACTIVE_KEY, id);
    if (!raw) return undefined;
    const match = deserialize(raw);
    if (!match) return undefined;
    touchCache(match);
    return match;
  } catch (err) {
    console.error("getMatch failed:", err);
    return undefined;
  }
}

export async function updateMatch(
  id: string,
  updates: Partial<ServerMatch>
): Promise<ServerMatch | undefined> {
  const existing = await getMatch(id);
  if (!existing) return undefined;

  Object.assign(existing, updates, { lastMoveAt: Date.now() });
  touchCache(existing);

  if (existing.status === "finished") {
    if (!existing.finishedAt) existing.finishedAt = Date.now();

    // Move from active hash to archive on finish. Awaited so the
    // /match/[id] permalink reliably resolves as soon as the client
    // sees the "finished" response.
    try {
      await archiveMatch(existing);
    } catch (err) {
      console.error("Archive failed:", err);
    }
    void evictActive(existing.id);

    if (existing.result) {
      void recordFinishedMatchIfNeeded({
        matchId: existing.id,
        whiteAgentId: existing.whiteAgent.id,
        blackAgentId: existing.blackAgent.id,
        result: existing.result,
      }).catch((err) => {
        console.error("Agent stats update failed:", err);
      });
    }
  } else {
    // Still live: persist in the background. The in-process cache already
    // has the latest state for this instance's reads, so the move response
    // doesn't need to wait on the Upstash round-trip.
    void persistActive(existing);
  }

  return existing;
}

export async function listActiveMatches(): Promise<ServerMatch[]> {
  try {
    const all = await kv.hgetall(ACTIVE_KEY);
    const matches = Object.values(all)
      .map(deserialize)
      .filter((m): m is ServerMatch => m !== null && m.status === "live")
      .sort((a, b) => b.lastMoveAt - a.lastMoveAt)
      .slice(0, 20);
    return matches;
  } catch (err) {
    console.error("listActiveMatches failed:", err);
    // Fall back to the per-process cache so things don't completely
    // break if Redis is down.
    return Array.from(cache.values())
      .filter((m) => m.status === "live")
      .sort((a, b) => b.lastMoveAt - a.lastMoveAt)
      .slice(0, 20);
  }
}

async function archiveMatch(match: ServerMatch): Promise<void> {
  await kv.set(ARCHIVE_KEY(match.id), serialize(match), ARCHIVE_TTL_SECONDS);
}

/**
 * Attach the on-chain settle_match tx digest once it's known. Settlement
 * usually happens after the match has already finished (and possibly
 * archived/evicted), so this checks cache, the active hash, and the
 * archive in turn and updates whichever copy exists.
 */
export async function attachSettleDigest(
  id: string,
  digest: string
): Promise<void> {
  const cached = cache.get(id);
  if (cached) {
    cached.settleDigest = digest;
  }

  try {
    const activeRaw = await kv.hget(ACTIVE_KEY, id);
    if (activeRaw) {
      const m = deserialize(activeRaw);
      if (m) {
        m.settleDigest = digest;
        touchCache(m);
        await kv.hset(ACTIVE_KEY, id, serialize(m));
        return;
      }
    }
  } catch (err) {
    console.error("attachSettleDigest (active) failed:", err);
  }

  try {
    const raw = await kv.get<string | ServerMatch>(ARCHIVE_KEY(id));
    if (raw) {
      const m = typeof raw === "string" ? deserialize(raw) : raw;
      if (m) {
        m.settleDigest = digest;
        touchCache(m);
        await kv.set(ARCHIVE_KEY(id), serialize(m), ARCHIVE_TTL_SECONDS);
      }
    }
  } catch (err) {
    console.error("attachSettleDigest (archive) failed:", err);
  }
}

/**
 * Look up a match for the /match/[id] permalink page or any other
 * consumer that doesn't care whether the match is active or done.
 * Checks active first, falls back to the 30-day archive.
 */
export async function getArchivedMatch(
  id: string
): Promise<ServerMatch | null> {
  const active = await getMatch(id);
  if (active) return active;

  try {
    const raw = await kv.get<string | ServerMatch>(ARCHIVE_KEY(id));
    if (!raw) return null;
    if (typeof raw === "string") return deserialize(raw);
    return raw as ServerMatch;
  } catch (err) {
    console.error("getArchivedMatch failed:", err);
    return null;
  }
}
