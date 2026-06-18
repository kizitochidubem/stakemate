import type { ActiveWager } from "@/contexts/WagerContext";

const STORAGE_KEY = "stakemate.activeWager.v1";

export interface PersistedWager extends ActiveWager {
  wallet: string;
}

export function persistActiveWager(
  wallet: string,
  wager: Omit<ActiveWager, "placedAt">
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedWager = {
      ...wager,
      wallet,
      placedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
  }
}

export function loadPersistedWager(wallet: string): PersistedWager | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWager;
    if (parsed.wallet !== wallet) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedWager(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}
