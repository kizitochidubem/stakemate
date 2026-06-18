"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  AdminUserRow,
  AdminUserSummary,
} from "@/lib/server/users";
import { explorerAddressUrl } from "@/lib/sui/network";

interface AdminPayload {
  summary: AdminUserSummary;
  users: AdminUserRow[];
  platform: {
    matchesPlayed: number;
    customAgents: number;
    storage: string;
  };
}

function shorten(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleString();
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [secret, setSecret] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AdminPayload | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    const res = await fetch("/api/admin/session", { cache: "no-store" });
    const json = (await res.json()) as {
      configured: boolean;
      authenticated: boolean;
    };
    setConfigured(json.configured);
    setAuthenticated(json.authenticated);
    return json.authenticated;
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (res.status === 401) {
        setAuthenticated(false);
        setData(null);
        return;
      }
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to load users");
      }
      const json = (await res.json()) as AdminPayload;
      setData(json);
      setAuthenticated(true);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession().then((ok) => {
      if (ok) void loadUsers();
    });
  }, [loadSession, loadUsers]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim() }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setLoginError(err.error ?? "Login failed");
        return;
      }
      setAuthenticated(true);
      setSecret("");
      await loadUsers();
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setData(null);
  }

  if (configured === null) {
    return (
      <main style={{ padding: 48, color: "var(--text-secondary)" }}>Loading…</main>
    );
  }

  if (!configured) {
    return (
      <main
        style={{
          maxWidth: 520,
          margin: "80px auto",
          padding: 24,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          Admin not configured
        </h1>
        <p>
          Set <code style={{ color: "var(--accent)" }}>STAKEMATE_ADMIN_SECRET</code> in
          Vercel (Production) and redeploy. Then return here and sign in.
        </p>
        <Link href="/" style={{ color: "var(--accent)", fontSize: 14 }}>
          ← Back to Stakemate
        </Link>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            width: "100%",
            maxWidth: 400,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 32,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Stakemate Admin
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
            Wallet visits and wagers tracked in Upstash.
          </p>
          <label
            htmlFor="admin-secret"
            style={{
              display: "block",
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 8,
              fontFamily: "var(--font-mono)",
            }}
          >
            Admin secret
          </label>
          <input
            id="admin-secret"
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: 14,
              marginBottom: 16,
            }}
          />
          {loginError ? (
            <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>
              {loginError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !secret.trim()}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "var(--bg-primary)",
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading || !secret.trim() ? 0.6 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)" }}>
            <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>
              ← Arena
            </Link>
          </p>
        </form>
      </main>
    );
  }

  const summary = data?.summary;
  const platform = data?.platform;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px 80px" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 800,
              color: "var(--text-primary)",
            }}
          >
            User dashboard
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Connected wallets · visits · wagers · storage:{" "}
            <span style={{ color: "var(--accent)" }}>{platform?.storage ?? "—"}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontSize: 13,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {fetchError ? (
        <p style={{ color: "var(--danger)", marginBottom: 16 }}>{fetchError}</p>
      ) : null}

      {summary ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <StatCard label="Users" value={summary.totalUsers} />
          <StatCard label="Active 24h" value={summary.activeLast24h} />
          <StatCard label="Active 7d" value={summary.activeLast7d} />
          <StatCard label="Visits" value={summary.totalVisits} />
          <StatCard label="Wagers" value={summary.totalWagers} />
          <StatCard
            label="Wagered SUI"
            value={summary.totalWageredSui}
            hint={`W ${summary.totalWins} · L ${summary.totalLosses} · R ${summary.totalRefunds}`}
          />
          <StatCard
            label="Matches played"
            value={platform?.matchesPlayed ?? 0}
          />
          <StatCard
            label="Custom agents"
            value={platform?.customAgents ?? 0}
          />
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--bg-secondary)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                {[
                  "Wallet",
                  "Last seen",
                  "Visits",
                  "Wagers",
                  "SUI wagered",
                  "W / L / R",
                  "Recent",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 14px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.users ?? []).map((u) => (
                <tr
                  key={u.wallet}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "12px 14px" }}>
                    <a
                      href={explorerAddressUrl(u.wallet)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent)",
                        textDecoration: "none",
                      }}
                      title={u.wallet}
                    >
                      {shorten(u.wallet)}
                    </a>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>
                    {formatWhen(u.lastSeenAt)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>{u.visitCount}</td>
                  <td style={{ padding: "12px 14px" }}>{u.wagerCount}</td>
                  <td style={{ padding: "12px 14px" }}>{u.totalWageredSui}</td>
                  <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)" }}>
                    {u.wins} / {u.losses} / {u.refunds}
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      color: "var(--text-muted)",
                      maxWidth: 200,
                    }}
                  >
                    {u.recentWagers.length === 0
                      ? "—"
                      : u.recentWagers
                          .slice(0, 2)
                          .map((w) => `${w.agentName} ${w.amount}◎`)
                          .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.users.length ?? 0) === 0 && !loading ? (
          <p style={{ padding: 24, color: "var(--text-muted)", textAlign: "center" }}>
            No users yet. They appear when a wallet connects on the site.
          </p>
        ) : null}
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)" }}>
        Page views and traffic: Vercel → Analytics. User rows require Upstash Redis.
      </p>
    </main>
  );
}
