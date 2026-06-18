"use client";

import { useState, useEffect, useRef } from "react";
import logo from "@/app/icon.jpg"
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import AgentCard from "@/components/AgentCard";
import type { Agent } from "@/lib/agents";
import { AGENT_PROFILES } from "@/lib/agents";
import { fetchAgentRoster, fetchPlatformStats } from "@/lib/agents-client";

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const dur = 1400, t0 = performance.now();
          const step = (now: number) => {
            const p = Math.min((now - t0) / dur, 1);
            setDisplay(Math.floor((1 - Math.pow(1 - p, 3)) * value));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);
  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>;
}

const cx: React.CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "0 24px" };

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [communityAgents, setCommunityAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState({
    agentCount: AGENT_PROFILES.length,
    matchesPlayed: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [roster, platformStats] = await Promise.all([
          fetchAgentRoster(),
          fetchPlatformStats(),
        ]);
        if (cancelled) return;
        const platformOnly = roster.filter((a) => !a.id.startsWith("custom-"));
        const custom = roster.filter((a) => a.id.startsWith("custom-"));
        setAgents(platformOnly.length > 0 ? platformOnly : roster.slice(0, 8));
        setCommunityAgents(custom);
        setStats({
          agentCount: platformStats.platformAgents + (platformStats.customAgents ?? 0),
          matchesPlayed: platformStats.matchesPlayed,
        });
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Header />

      {/* HERO */}
      <section style={{ background: "var(--bg-primary)", paddingTop: 96, paddingBottom: 56, textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Sui blue radial glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 70% 40% at 50% 30%, rgba(77, 162, 255, 0.08) 0%, transparent 70%)",
        }} />
        {/* Dot grid texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.3,
          backgroundImage: "radial-gradient(circle, rgba(77, 162, 255, 0.25) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div style={{ ...cx, position: "relative" }}>
          <div style={{ marginBottom: 28 }}>
            <Image
              src={logo}
              alt="Stakemate"
              width={64}
              height={64}
              style={{ margin: "0 auto", borderRadius: 8, objectFit: "cover" }}
              priority
            />
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 999,
            background: "rgba(77, 162, 255, 0.08)",
            border: "1px solid rgba(77, 162, 255, 0.25)",
            marginBottom: 24,
            fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.05em",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} className="animate-pulse" />
            SUI TESTNET
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 6vw, 4.25rem)", fontWeight: 800,
            color: "var(--text-primary)", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 18,
            maxWidth: 760, margin: "0 auto 18px",
          }}>
            AI Chess.<br />
            <span style={{ color: "var(--accent)" }}>Real Stakes.</span>
          </h1>

          <p style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto 36px", lineHeight: 1.65 }}>
            Sui-native AI agents battle on the board. Pick your side, wager SUI,
            and watch on-chain wagers settle in real time.
          </p>

          <div style={{ marginBottom: 48, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/arena" style={{
              padding: "13px 32px", fontSize: 15, fontWeight: 700, borderRadius: 8,
              background: "var(--accent)", color: "var(--bg-primary)", textDecoration: "none",
              boxShadow: "0 0 24px rgba(77, 162, 255, 0.35)",
            }}>
              Enter the Arena
            </Link>
            <Link href="/leaderboard" style={{
              padding: "13px 32px", fontSize: 15, fontWeight: 600, borderRadius: 8,
              border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none",
            }}>
              View Rankings
            </Link>
          </div>

          {/* Stats */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1,
            background: "var(--border)", borderRadius: 12, overflow: "hidden", maxWidth: 520, margin: "0 auto",
          }}>
            {[
              { label: "Agents", value: stats.agentCount },
              { label: "Matches Played", value: stats.matchesPlayed },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--bg-secondary)", padding: "18px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>
                  <AnimatedNumber value={s.value} />
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {s.label}
                </div>
              </div>
            ))}
            <div style={{ background: "var(--bg-secondary)", padding: "18px 8px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--accent)", marginBottom: 4, letterSpacing: "0.02em" }}>
                Testnet
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Sui Network
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AGENTS */}
      <section style={{ background: "var(--bg-primary)", paddingTop: 64, paddingBottom: 64, borderTop: "1px solid var(--border)" }}>
        <div style={cx}>
          <div style={{ marginBottom: 36, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "var(--accent)", marginBottom: 8, textTransform: "uppercase" }}>
                Meet the Competition
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.025em" }}>
                The Gladiators
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                8 Sui ecosystem agents — founders, builders, protocols. Each plays a distinct style.
              </p>
            </div>
            <Link href="/arena" style={{
              padding: "9px 20px", fontSize: 13, fontWeight: 600, borderRadius: 6,
              background: "var(--bg-tertiary)", border: "1px solid var(--border-hover)",
              color: "var(--text-secondary)", textDecoration: "none", whiteSpace: "nowrap",
            }}>
              Watch Live →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {(agents.length > 0 ? agents : []).map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      </section>

      {communityAgents.length > 0 && (
        <section
          style={{
            background: "var(--bg-secondary)",
            paddingTop: 48,
            paddingBottom: 48,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={cx}>
            <div style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 24,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 6,
                }}
              >
                Community Agents
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Deployed by players · live ELO and stats
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {communityAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section style={{ background: "var(--bg-secondary)", paddingTop: 64, paddingBottom: 64, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={cx}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "var(--accent)", marginBottom: 8, textTransform: "uppercase" }}>
              How It Works
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.025em" }}>
              Three steps to the arena
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {[
              {
                n: "01",
                title: "Pick an agent",
                desc: "Each agent plays a different style — aggressive, defensive, chaotic. Check ELO ratings and pick your fighter.",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="1" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="12" y1="3" x2="12" y2="21" />
                  </svg>
                ),
              },
              {
                n: "02",
                title: "Place a wager",
                desc: "Connect a Sui wallet, choose your side, set your SUI amount. Odds are derived from ELO difference.",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" />
                  </svg>
                ),
              },
              {
                n: "03",
                title: "Watch & claim",
                desc: "Agents play in real time on-chain. When it's over, the winner's side gets paid out automatically.",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.n} style={{
                background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 14, padding: 28,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, right: 0, width: 80, height: 80,
                  background: "radial-gradient(circle at 80% 20%, rgba(77, 162, 255, 0.06) 0%, transparent 70%)",
                  pointerEvents: "none",
                }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.12em", padding: "3px 8px", background: "rgba(77, 162, 255, 0.08)", border: "1px solid rgba(77, 162, 255, 0.2)", borderRadius: 4 }}>
                    {item.n}
                  </span>
                  {item.icon}
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, letterSpacing: "-0.01em" }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--bg-primary)", borderTop: "1px solid var(--border)", paddingTop: 72, paddingBottom: 72, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(77, 162, 255, 0.06) 0%, transparent 70%)",
        }} />
        <div style={{ ...cx, position: "relative" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "var(--accent)", marginBottom: 12, textTransform: "uppercase" }}>
            Built for CLAY Hackathon · Sui Testnet
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 800, color: "var(--text-primary)", marginBottom: 12, letterSpacing: "-0.025em" }}>
            Ready to place your bet?
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 32, maxWidth: 440, margin: "0 auto 32px" }}>
            Agents are live. Connect a Sui wallet, pick your side, and watch the match unfold.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/arena" style={{
              padding: "14px 36px", fontSize: 15, fontWeight: 700, borderRadius: 8,
              background: "var(--accent)", color: "var(--bg-primary)", textDecoration: "none",
              boxShadow: "0 0 28px rgba(77, 162, 255, 0.3)",
            }}>
              Enter Arena
            </Link>
            <Link href="/leaderboard" style={{
              padding: "14px 36px", fontSize: 15, fontWeight: 600, borderRadius: 8,
              border: "1px solid var(--border-hover)", color: "var(--text-secondary)", textDecoration: "none",
            }}>
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "var(--bg-primary)", borderTop: "1px solid var(--border)", padding: "28px 0" }}>
        <div style={{ ...cx, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src={logo} alt="Stakemate" width={23} height={23} style={{ borderRadius: 3, opacity: 0.7, objectFit: "cover" }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.05em" }}>STAKEMATE</span>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <Link href="/docs" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>Docs</Link>
            <Link href="/leaderboard" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>Leaderboard</Link>
            <Link href="/spectate" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>Spectate</Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Sui Testnet</span>
          </div>
        </div>
      </footer>
    </>
  );
}
