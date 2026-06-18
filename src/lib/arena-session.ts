const STORAGE_KEY = "stakemate.arenaSession.v1";

export interface ArenaSession {
  wallet: string;
  matchId: string;
  updatedAt: number;
}

export function persistArenaSession(wallet: string, matchId: string): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ArenaSession = {
      wallet,
      matchId,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadArenaSession(wallet: string): ArenaSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ArenaSession;
    if (parsed.wallet !== wallet) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearArenaSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
