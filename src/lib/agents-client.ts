import type { Agent } from "./agents";
import { fetchJson } from "./fetch-json";

export interface ApiAgent {
  id: string;
  name: string;
  elo: number;
  style: string;
  personality: Agent["personality"];
  lore: string;
  sigil: string;
  wins: number;
  losses: number;
  draws: number;
  depth?: number;
  recentResults?: ("W" | "L" | "D")[];
  winRate?: number;
  source?: "platform" | "openclaw";
  avatarUrl?: string;
  nftMint?: string;
}

export function apiAgentToAgent(a: ApiAgent): Agent {
  return {
    id: a.id,
    name: a.name,
    elo: a.elo,
    style: a.style,
    lore: a.lore,
    sigil: a.sigil,
    wins: a.wins,
    losses: a.losses,
    draws: a.draws,
    depth: a.depth ?? 4,
    personality: a.personality,
    recentResults: a.recentResults ?? [],
    avatarUrl: a.avatarUrl,
    nftMint: a.nftMint,
  };
}

export async function fetchAgentRoster(): Promise<Agent[]> {
  const data = await fetchJson<{ agents: ApiAgent[] }>("/api/agents", {
    cache: "no-store",
    timeoutMs: 20_000,
  });
  return data.agents.map(apiAgentToAgent);
}

/** Merge live W/L/D and ELO onto an agent (identity fields unchanged). */
export function mergeLiveStats(existing: Agent, live: Agent): Agent {
  return {
    ...existing,
    elo: live.elo,
    wins: live.wins,
    losses: live.losses,
    draws: live.draws,
    recentResults: live.recentResults,
  };
}

/** Pull latest stats for two agents · used to refresh wager odds after a match. */
export async function fetchAgentsByIds(
  whiteId: string,
  blackId: string
): Promise<{ white?: Agent; black?: Agent }> {
  const roster = await fetchAgentRoster();
  return {
    white: roster.find((a) => a.id === whiteId),
    black: roster.find((a) => a.id === blackId),
  };
}

export interface PlatformStats {
  platformAgents: number;
  customAgents: number;
  matchesPlayed: number;
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  try {
    return await fetchJson<PlatformStats>("/api/stats", {
      cache: "no-store",
      timeoutMs: 15_000,
    });
  } catch {
    return { platformAgents: 8, customAgents: 0, matchesPlayed: 0 };
  }
}
