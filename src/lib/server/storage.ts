/**
 * Persistent storage with graceful in-memory fallback.
 *
 * Uses Upstash Redis (works on Vercel serverless) when configured via:
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 *
 * Otherwise falls back to an in-memory Map. The fallback is fine for
 * local dev, but data is lost on every Vercel serverless cold start.
 *
 * We define a minimal KV interface so the rest of the app doesn't
 * care whether Redis is wired in or not.
 */

interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  hset(key: string, field: string, value: string): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, field: string): Promise<void>;
  hlen(key: string): Promise<number>;
  /** Profile keys only: user:{wallet}, not wager lists. */
  scanUserProfileKeys(): Promise<string[]>;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const memStore = new Map<string, unknown>();
const memHash = new Map<string, Map<string, string>>();

function memKV(): KV {
  return {
    async get<T>(key: string): Promise<T | null> {
      return (memStore.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      memStore.set(key, value);
    },
    async hset(key, field, value) {
      let h = memHash.get(key);
      if (!h) {
        h = new Map();
        memHash.set(key, h);
      }
      h.set(field, value);
    },
    async hget(key, field) {
      return memHash.get(key)?.get(field) ?? null;
    },
    async hgetall(key) {
      const h = memHash.get(key);
      if (!h) return {};
      const out: Record<string, string> = {};
      for (const [k, v] of h) out[k] = v;
      return out;
    },
    async hdel(key, field) {
      memHash.get(key)?.delete(field);
    },
    async hlen(key) {
      return memHash.get(key)?.size ?? 0;
    },
    async scanUserProfileKeys() {
      return [...memStore.keys()].filter(
        (k) => k.startsWith("user:") && !k.includes(":wagers")
      );
    },
  };
}

async function upstashFetch(command: (string | number)[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error("Upstash not configured");
  }
  const res = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash error: ${res.status}`);
  }
  const data = await res.json();
  return data.result;
}

function upstashKV(): KV {
  return {
    async get<T>(key: string): Promise<T | null> {
      const result = await upstashFetch(["GET", key]);
      if (result === null || result === undefined) return null;
      try {
        return typeof result === "string" ? (JSON.parse(result) as T) : (result as T);
      } catch {
        return result as T;
      }
    },
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);
      const cmd: (string | number)[] = ["SET", key, serialized];
      if (ttlSeconds) cmd.push("EX", ttlSeconds);
      await upstashFetch(cmd);
    },
    async hset(key, field, value) {
      await upstashFetch(["HSET", key, field, value]);
    },
    async hget(key, field) {
      const v = await upstashFetch(["HGET", key, field]);
      return v === null || v === undefined ? null : String(v);
    },
    async hgetall(key) {
      const v = (await upstashFetch(["HGETALL", key])) as
        | Record<string, string>
        | null;
      return v ?? {};
    },
    async hdel(key, field) {
      await upstashFetch(["HDEL", key, field]);
    },
    async hlen(key) {
      const v = (await upstashFetch(["HLEN", key])) as number;
      return v ?? 0;
    },
    async scanUserProfileKeys() {
      const raw = (await upstashFetch(["KEYS", "user:*"])) as string[] | null;
      if (!raw?.length) return [];
      return raw.filter((k) => !k.includes(":wagers"));
    },
  };
}

const isUpstashConfigured = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

export const kv: KV = isUpstashConfigured ? upstashKV() : memKV();

export const storageMode: "upstash" | "memory" = isUpstashConfigured
  ? "upstash"
  : "memory";
