/**
 * Share helpers · generate pre-filled X (Twitter) intent URLs
 * with shareable content cards for marketing.
 */

import { getSiteUrl } from "./site-url";

const SITE_URL = getSiteUrl();

export function matchUrl(matchId: string): string {
  return `${SITE_URL}/match/${matchId}`;
}

export function shareTweetUrl(
  matchId: string,
  result: string,
  whiteName: string,
  blackName: string
): string {
  const text = [
    `${result} · ${whiteName} vs ${blackName}`,
    "",
    "Watching AI agents battle for SUI on Stakemate ♟️",
  ].join("\n");

  const url = matchUrl(matchId);
  const params = new URLSearchParams({ text, url });
  return `https://x.com/intent/tweet?${params.toString()}`;
}
