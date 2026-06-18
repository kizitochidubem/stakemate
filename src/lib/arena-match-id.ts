/** Unique id for one arena round · must change between wagers (one wager PDA per match+wallet). */
export function freshArenaMatchId(): string {
  return `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
