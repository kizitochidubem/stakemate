"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StakemateUser, UserWagerRecord } from "@/lib/server/users";
import Spinner from "./Spinner";

interface StakemateProfileCardProps {
  wallet: string;
}

export default function StakemateProfileCard({ wallet }: StakemateProfileCardProps) {
  const [user, setUser] = useState<StakemateUser | null>(null);
  const [wagers, setWagers] = useState<UserWagerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/users/${wallet}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) {
          setMissing(true);
          setUser(null);
          setWagers([]);
          return;
        }
        if (!res.ok) throw new Error("Failed to load profile");
        const data = (await res.json()) as {
          user: StakemateUser;
          wagers: UserWagerRecord[];
        };
        setUser(data.user);
        setWagers(data.wagers);
        setMissing(false);
      } catch {
        if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (loading) {
    return (
      <div
        style={{
          padding: 20,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Spinner size={20} />
      </div>
    );
  }

  if (missing || !user) {
    return (
      <div
        style={{
          padding: 20,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--text-muted)",
          }}
        >
          STAKEMATE PROFILE
        </span>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
          No arena history yet. Place a wager on{" "}
          <Link href="/arena" style={{ color: "var(--accent)" }}>
            /arena
          </Link>{" "}
          to start tracking.
        </p>
      </div>
    );
  }

  const winRate =
    user.wins + user.losses > 0
      ? Math.round((user.wins / (user.wins + user.losses)) * 100)
      : 0;

  return (
    <div
      style={{
        padding: 20,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.2em",
          color: "var(--accent)",
          display: "block",
          marginBottom: 12,
        }}
      >
        STAKEMATE PROFILE
      </span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {[
          { label: "WAGERS", value: String(user.wagerCount) },
          { label: "WAGERED", value: `${user.totalWageredSui.toFixed(2)} SUI` },
          { label: "WINS", value: String(user.wins) },
          { label: "WIN RATE", value: `${winRate}%` },
        ].map((row) => (
          <div key={row.label}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--text-muted)",
                letterSpacing: "0.1em",
              }}
            >
              {row.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>
      {wagers.length > 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--text-muted)",
              letterSpacing: "0.15em",
              marginBottom: 8,
            }}
          >
            RECENT WAGERS
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {wagers.slice(0, 5).map((w) => (
              <li
                key={w.signature}
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  padding: "6px 0",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span>
                  {w.amount} SUI · {w.agentName}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {w.outcome?.toUpperCase() ?? "OPEN"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 12 }}>
        Visits: {user.visitCount} · member since{" "}
        {new Date(user.firstSeenAt).toLocaleDateString()}
      </p>
    </div>
  );
}
