"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface LiveMatch {
  id: string;
  whiteAgent: { id: string; name: string };
  blackAgent: { id: string; name: string };
  moveCount: number;
  status: "live" | "finished";
  startedAt: number;
}

export default function SpectatePage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/match/list", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load matches");
        const data = await res.json();
        if (!cancelled) setMatches(data.matches ?? []);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const id = setInterval(() => void load(), 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <Header />
      <main style={{ background: "var(--bg-primary)", paddingTop: 56, minHeight: "100vh" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.3em",
                color: "var(--accent)",
                display: "block",
                marginBottom: 12,
              }}
            >
              SPECTATE
            </span>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 36,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 8,
                letterSpacing: "-0.02em",
              }}
            >
              Live Matches
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Real-time matches happening right now.
            </p>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div className="loading-bar" style={{ width: 200, margin: "0 auto" }} />
            </div>
          ) : matches.length === 0 ? (
            <div
              style={{
                padding: 48,
                textAlign: "center",
                background: "var(--bg-secondary)",
                border: "1px dashed var(--border)",
                borderRadius: 12,
              }}
            >
              <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 8 }}>
                No matches running right now.
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
                Be the first to start one.
              </p>
              <Link
                href="/arena"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  background: "var(--accent)",
                  color: "var(--bg-primary)",
                  textDecoration: "none",
                }}
              >
                Start a Match →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {matches.map((m) => (
                <Link
                  key={m.id}
                  href={`/arena?white=${m.whiteAgent.id}&black=${m.blackAgent.id}`}
                  style={{
                    display: "block",
                    padding: 20,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        letterSpacing: "0.2em",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "var(--accent)",
                      }}
                    >
                      <span
                        className="animate-pulse"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--accent)",
                        }}
                      />
                      LIVE
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: "var(--text-muted)",
                      }}
                    >
                      move {m.moveCount}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {m.whiteAgent.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 14,
                        color: "var(--text-muted)",
                      }}
                    >
                      vs
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {m.blackAgent.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
