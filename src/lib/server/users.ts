/**
 * Wallet-based user profiles stored in KV (Upstash or in-memory).
 * The wallet address is the primary user id · no email/password.
 */

import { kv } from "./storage";
import { isValidSuiAddress } from "@/lib/sui/network";

export interface StakemateUser {
  wallet: string;
  firstSeenAt: number;
  lastSeenAt: number;
  visitCount: number;
  totalWageredSui: number;
  wagerCount: number;
  wins: number;
  losses: number;
  refunds: number;
}

export interface UserWagerRecord {
  signature: string;
  matchId: string;
  amount: number;
  side: "white" | "black";
  agentName: string;
  placedAt: number;
  outcome?: "won" | "lost" | "refund";
  settledAt?: number;
}

const USER_KEY = (wallet: string) => `user:${wallet}`;
const WAGERS_KEY = (wallet: string) => `user:${wallet}:wagers`;
const USERS_INDEX_KEY = "users:index";
const MAX_WAGERS = 100;

export interface AdminUserSummary {
  totalUsers: number;
  activeLast24h: number;
  activeLast7d: number;
  totalVisits: number;
  totalWagers: number;
  totalWageredSui: number;
  totalWins: number;
  totalLosses: number;
  totalRefunds: number;
}

export interface AdminUserRow extends StakemateUser {
  recentWagers: UserWagerRecord[];
}

function isValidWallet(wallet: string): boolean {
  return isValidSuiAddress(wallet);
}

export async function trackUserVisit(wallet: string): Promise<StakemateUser> {
  if (!isValidWallet(wallet)) {
    throw new Error("Invalid wallet address");
  }

  const key = USER_KEY(wallet);
  const existing = await kv.get<StakemateUser>(key);
  const now = Date.now();

  if (existing) {
    const updated: StakemateUser = {
      ...existing,
      lastSeenAt: now,
      visitCount: existing.visitCount + 1,
    };
    await kv.set(key, updated);
    await touchUserIndex(wallet, now);
    return updated;
  }

  const created: StakemateUser = {
    wallet,
    firstSeenAt: now,
    lastSeenAt: now,
    visitCount: 1,
    totalWageredSui: 0,
    wagerCount: 0,
    wins: 0,
    losses: 0,
    refunds: 0,
  };
  await kv.set(key, created);
  await kv.hset(USERS_INDEX_KEY, wallet, String(now));
  return created;
}

async function touchUserIndex(wallet: string, at = Date.now()): Promise<void> {
  await kv.hset(USERS_INDEX_KEY, wallet, String(at));
}

export async function getUser(wallet: string): Promise<StakemateUser | null> {
  if (!isValidWallet(wallet)) return null;
  return kv.get<StakemateUser>(USER_KEY(wallet));
}

export async function recordUserWager(
  wallet: string,
  record: Omit<UserWagerRecord, "placedAt"> & { placedAt?: number }
): Promise<void> {
  if (!isValidWallet(wallet)) {
    throw new Error("Invalid wallet address");
  }

  const user = await trackUserVisit(wallet);

  const updated: StakemateUser = {
    ...user,
    totalWageredSui:
      Math.round((user.totalWageredSui + record.amount) * 1000) / 1000,
    wagerCount: user.wagerCount + 1,
    lastSeenAt: Date.now(),
  };
  await kv.set(USER_KEY(wallet), updated);
  await touchUserIndex(wallet, updated.lastSeenAt);

  const entry: UserWagerRecord = {
    ...record,
    placedAt: record.placedAt ?? Date.now(),
  };

  const wagers =
    (await kv.get<UserWagerRecord[]>(WAGERS_KEY(wallet))) ?? [];
  const next = [entry, ...wagers.filter((w) => w.signature !== entry.signature)].slice(
    0,
    MAX_WAGERS
  );
  await kv.set(WAGERS_KEY(wallet), next);
}

export async function recordUserSettlement(
  wallet: string,
  matchId: string,
  outcome: "won" | "lost" | "refund"
): Promise<void> {
  if (!isValidWallet(wallet)) return;

  const user = await kv.get<StakemateUser>(USER_KEY(wallet));
  if (!user) return;

  const stats = { ...user, lastSeenAt: Date.now() };
  if (outcome === "won") stats.wins += 1;
  else if (outcome === "lost") stats.losses += 1;
  else stats.refunds += 1;
  await kv.set(USER_KEY(wallet), stats);

  const wagers =
    (await kv.get<UserWagerRecord[]>(WAGERS_KEY(wallet))) ?? [];
  const idx = wagers.findIndex((w) => w.matchId === matchId && !w.outcome);
  if (idx >= 0) {
    wagers[idx] = {
      ...wagers[idx],
      outcome,
      settledAt: Date.now(),
    };
    await kv.set(WAGERS_KEY(wallet), wagers);
  }
}

export async function getUserWagers(
  wallet: string,
  limit = 20
): Promise<UserWagerRecord[]> {
  if (!isValidWallet(wallet)) return [];
  const wagers =
    (await kv.get<UserWagerRecord[]>(WAGERS_KEY(wallet))) ?? [];
  return wagers.slice(0, limit);
}

/** Backfill index from legacy user:* keys (one-time when index was empty). */
async function backfillUserIndexIfNeeded(): Promise<void> {
  const index = await kv.hgetall(USERS_INDEX_KEY);
  if (Object.keys(index).length > 0) return;

  const keys = await kv.scanUserProfileKeys();
  for (const key of keys) {
    const wallet = key.replace(/^user:/, "");
    if (!isValidWallet(wallet)) continue;
    const user = await kv.get<StakemateUser>(key);
    if (user) {
      await kv.hset(USERS_INDEX_KEY, wallet, String(user.lastSeenAt));
    }
  }
}

export async function listUsersForAdmin(
  limit = 250
): Promise<AdminUserRow[]> {
  await backfillUserIndexIfNeeded();

  const index = await kv.hgetall(USERS_INDEX_KEY);
  const wallets = Object.entries(index)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, limit)
    .map(([wallet]) => wallet);

  const rows = await Promise.all(
    wallets.map(async (wallet) => {
      const user = await getUser(wallet);
      if (!user) return null;
      const recentWagers = await getUserWagers(wallet, 5);
      return { ...user, recentWagers };
    })
  );

  return rows.filter((r): r is AdminUserRow => r !== null);
}

export async function getAdminUserSummary(): Promise<AdminUserSummary> {
  const users = await listUsersForAdmin(500);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;

  return {
    totalUsers: users.length,
    activeLast24h: users.filter((u) => now - u.lastSeenAt < day).length,
    activeLast7d: users.filter((u) => now - u.lastSeenAt < week).length,
    totalVisits: users.reduce((s, u) => s + u.visitCount, 0),
    totalWagers: users.reduce((s, u) => s + u.wagerCount, 0),
    totalWageredSui:
      Math.round(users.reduce((s, u) => s + u.totalWageredSui, 0) * 1000) /
      1000,
    totalWins: users.reduce((s, u) => s + u.wins, 0),
    totalLosses: users.reduce((s, u) => s + u.losses, 0),
    totalRefunds: users.reduce((s, u) => s + u.refunds, 0),
  };
}
