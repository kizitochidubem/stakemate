import { unstable_cache } from "next/cache";
import { getPlatformAgentsWithStats, type AgentWithStats } from "./agent-stats";
import { ROSTER_CACHE_TAG } from "./roster-invalidate";

const ROSTER_REVALIDATE_SEC = 5;

async function loadRoster(): Promise<{ platform: AgentWithStats[] }> {
  const platform = await getPlatformAgentsWithStats();
  return { platform };
}

export const getCachedAgentRoster = unstable_cache(
  loadRoster,
  ["agent-roster-v1"],
  { revalidate: ROSTER_REVALIDATE_SEC, tags: [ROSTER_CACHE_TAG] }
);

export const rosterCacheHeaders = {
  "Cache-Control": `public, s-maxage=${ROSTER_REVALIDATE_SEC}, stale-while-revalidate=30`,
};
