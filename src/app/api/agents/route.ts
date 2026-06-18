import { getCachedAgentRoster, rosterCacheHeaders } from "@/lib/server/cached-roster";
import { handleRouteError, jsonOk } from "@/lib/server/api-error";
import { storageMode } from "@/lib/server/storage";

export const runtime = "nodejs";

/**
 * GET /api/agents · platform agent roster with live stats.
 */
export async function GET() {
  try {
    const { platform } = await getCachedAgentRoster();
    const agents = platform.map((a) => ({
      id: a.id,
      name: a.name,
      elo: a.elo,
      style: a.style,
      personality: a.personality,
      lore: a.lore,
      sigil: a.sigil,
      depth: a.depth,
      wins: a.wins,
      losses: a.losses,
      draws: a.draws,
      recentResults: a.recentResults,
      winRate: a.winRate,
      source: "platform" as const,
    }));

    return jsonOk(
      { agents, total: agents.length, storageMode },
      { headers: rosterCacheHeaders }
    );
  } catch (err) {
    return handleRouteError("agents/GET", err);
  }
}
