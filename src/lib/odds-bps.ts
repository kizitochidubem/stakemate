/** Convert UI odds multiplier (e.g. 1.8) to basis points (18000). */
export function oddsToBps(odds: number): number {
  if (!Number.isFinite(odds) || odds < 1) return 10_000;
  return Math.min(65_535, Math.max(10_000, Math.round(odds * 10_000)));
}
