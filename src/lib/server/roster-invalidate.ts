import { revalidateTag } from "next/cache";

export const ROSTER_CACHE_TAG = "agent-roster";

export function invalidateAgentRosterCache(): void {
  try {
    revalidateTag(ROSTER_CACHE_TAG, "seconds");
  } catch {
    /* outside request context */
  }
}
