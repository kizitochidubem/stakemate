/**
 * Live agent statistics · every finished match updates W/L/D, recent form, and ELO.
 */

import {
  AGENT_PROFILES,
  LEGACY_AGENT_ID_ALIASES,
  resolveAgentId,
  type AgentProfile,
} from "@/lib/agents";
import { invalidateAgentRosterCache } from "./roster-invalidate";
import { kv } from "./storage";

export interface AgentStatsRecord {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  recentResults: ("W" | "L" | "D")[];
  totalGames: number;
  updatedAt: number;
}

export interface AgentWithStats extends AgentProfile {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  recentResults: ("W" | "L" | "D")[];
  winRate: number;
}

const STATS_KEY = (id: string) => `agent:stats:${id}`;
const RECORDED_MATCH_KEY = (matchId: string) => `match:stats-recorded:${matchId}`;
const GLOBAL_MATCHES_KEY = "stats:matches:total";
const K_FACTOR = 32;
const RECENT_CAP = 20;
const RECORDED_TTL = 90 * 24 * 60 * 60;

function emptyStats(baseElo: number): AgentStatsRecord {
  return {
    elo: baseElo,
    wins: 0,
    losses: 0,
    draws: 0,
    recentResults: [],
    totalGames: 0,
    updatedAt: Date.now(),
  };
}

function profileBaseElo(agentId: string): number {
  const profile = AGENT_PROFILES.find((a) => a.id === agentId);
  return profile?.baseElo ?? 1500;
}

/** Only platform + custom agents get W/L/D and ELO (not human players). */
export function isTrackableAgent(agentId: string): boolean {
  if (agentId === "human") return false;
  if (agentId.startsWith("custom-")) return true;
  const resolved = resolveAgentId(agentId);
  return AGENT_PROFILES.some((p) => p.id === resolved);
}

const HUMAN_OPPONENT_ELO = 1200;

async function opponentElo(opponentId: string): Promise<number> {
  if (opponentId === "human") return HUMAN_OPPONENT_ELO;
  const stats = await getAgentStats(opponentId);
  return stats.elo;
}

async function loadStatsWithLegacyMerge(canonicalId: string): Promise<AgentStatsRecord | null> {
  const current = await kv.get<AgentStatsRecord>(STATS_KEY(canonicalId));
  if (current) return current;

  const legacyId = Object.entries(LEGACY_AGENT_ID_ALIASES).find(
    ([, next]) => next === canonicalId
  )?.[0];
  if (!legacyId) return null;

  const legacy = await kv.get<AgentStatsRecord>(STATS_KEY(legacyId));
  if (!legacy) return null;

  await kv.set(STATS_KEY(canonicalId), legacy);
  return legacy;
}

export async function getAgentStats(agentId: string): Promise<AgentStatsRecord> {
  const canonical = resolveAgentId(agentId);
  const merged = await loadStatsWithLegacyMerge(canonical);
  if (merged) return merged;
  return emptyStats(profileBaseElo(canonical));
}

export async function initAgentStats(
  agentId: string,
  startingElo?: number
): Promise<AgentStatsRecord> {
  const existing = await kv.get<AgentStatsRecord>(STATS_KEY(agentId));
  if (existing) return existing;
  const stats = emptyStats(startingElo ?? profileBaseElo(agentId));
  await kv.set(STATS_KEY(agentId), stats);
  return stats;
}

function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

function nextElo(
  playerElo: number,
  opponentElo: number,
  score: 0 | 0.5 | 1
): number {
  const expected = expectedScore(playerElo, opponentElo);
  return Math.round(playerElo + K_FACTOR * (score - expected));
}

function resultForSide(
  side: "white" | "black",
  matchResult: "white" | "black" | "draw"
): "W" | "L" | "D" {
  if (matchResult === "draw") return "D";
  if (matchResult === side) return "W";
  return "L";
}

function applyResult(
  stats: AgentStatsRecord,
  letter: "W" | "L" | "D",
  newElo: number
): AgentStatsRecord {
  const recent = [...stats.recentResults, letter].slice(-RECENT_CAP);
  return {
    elo: newElo,
    wins: stats.wins + (letter === "W" ? 1 : 0),
    losses: stats.losses + (letter === "L" ? 1 : 0),
    draws: stats.draws + (letter === "D" ? 1 : 0),
    recentResults: recent,
    totalGames: stats.totalGames + 1,
    updatedAt: Date.now(),
  };
}

async function persistAgentResult(
  agentId: string,
  opponentElo: number,
  side: "white" | "black",
  matchResult: "white" | "black" | "draw"
): Promise<void> {
  const stats = await getAgentStats(agentId);
  const letter = resultForSide(side, matchResult);
  const score = letter === "W" ? 1 : letter === "D" ? 0.5 : 0;
  const newElo = nextElo(stats.elo, opponentElo, score);
  const updated = applyResult(stats, letter, newElo);
  await kv.set(STATS_KEY(agentId), updated);
}

export interface FinishedMatchAgents {
  matchId: string;
  whiteAgentId: string;
  blackAgentId: string;
  result: "white" | "black" | "draw";
}

/** Idempotent · safe if updateMatch runs twice. */
export async function recordFinishedMatchIfNeeded(
  match: FinishedMatchAgents
): Promise<void> {
  if (!match.result) return;

  const dedupe = await kv.get<boolean>(RECORDED_MATCH_KEY(match.matchId));
  if (dedupe) return;

  const tasks: Promise<void>[] = [
    kv.set(RECORDED_MATCH_KEY(match.matchId), true, RECORDED_TTL),
    incrementGlobalMatchCount(),
  ];

  const whiteId = resolveAgentId(match.whiteAgentId);
  const blackId = resolveAgentId(match.blackAgentId);

  if (isTrackableAgent(whiteId)) {
    const blackElo = await opponentElo(blackId);
    tasks.push(persistAgentResult(whiteId, blackElo, "white", match.result));
  }

  if (isTrackableAgent(blackId)) {
    const whiteElo = await opponentElo(whiteId);
    tasks.push(persistAgentResult(blackId, whiteElo, "black", match.result));
  }

  await Promise.all(tasks);
  invalidateAgentRosterCache();
}

async function incrementGlobalMatchCount(): Promise<void> {
  const current = (await kv.get<number>(GLOBAL_MATCHES_KEY)) ?? 0;
  await kv.set(GLOBAL_MATCHES_KEY, current + 1);
}

export async function getGlobalMatchCount(): Promise<number> {
  return (await kv.get<number>(GLOBAL_MATCHES_KEY)) ?? 0;
}

export function mergeProfileWithStats(
  profile: AgentProfile,
  stats: AgentStatsRecord
): AgentWithStats {
  const total = stats.wins + stats.losses + stats.draws;
  return {
    ...profile,
    elo: stats.elo,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    recentResults: stats.recentResults,
    winRate: total > 0 ? Math.round((stats.wins / total) * 100) : 0,
  };
}

export async function getPlatformAgentsWithStats(): Promise<AgentWithStats[]> {
  return Promise.all(
    AGENT_PROFILES.map(async (profile) => {
      const stats = await getAgentStats(profile.id);
      return mergeProfileWithStats(profile, stats);
    })
  );
}

export async function getAgentWithStats(
  agentId: string
): Promise<AgentWithStats | null> {
  const resolved = resolveAgentId(agentId);
  const profile = AGENT_PROFILES.find((a) => a.id === resolved);
  if (!profile) return null;
  const stats = await getAgentStats(resolved);
  return mergeProfileWithStats(profile, stats);
}

/** Map API/stats shape to client Agent type */
export function toClientAgent(a: AgentWithStats) {
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
    depth: a.depth,
    personality: a.personality,
    recentResults: a.recentResults,
    xHandle: a.xHandle,
  };
}
