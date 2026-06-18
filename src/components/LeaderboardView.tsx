"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import type { Agent } from "@/lib/agents";
import { getWinRate } from "@/lib/agents";
import AgentPortrait from "@/components/AgentPortrait";
import Sparkline from "@/components/Sparkline";
import Spinner from "@/components/Spinner";
import styles from "./leaderboard.module.css";

interface LeaderboardViewProps {
  agents: Agent[];
  loading: boolean;
  error: string | null;
}

const PODIUM_ORDER_DESKTOP = [1, 0, 2] as const; // 2nd, 1st, 3rd
const RANK_META = {
  1: { medal: "🥇", accent: "var(--accent)", tint: "rgba(77, 162, 255, 0.14)", h: 168, num: 48 },
  2: { medal: "🥈", accent: "#b8b8bc", tint: "rgba(180, 180, 188, 0.1)", h: 120, num: 36 },
  3: { medal: "🥉", accent: "#cd9b6e", tint: "rgba(205, 155, 110, 0.12)", h: 96, num: 32 },
} as const;

function isCommunity(agent: Agent): boolean {
  return agent.id.startsWith("custom-");
}

function arenaHref(agentId: string): string {
  return `/arena?white=${agentId}&black=lofi`;
}

function AgentNameLine({ agent }: { agent: Agent }) {
  return (
    <span className={styles.agentName}>
      {agent.name}
      {isCommunity(agent) && (
        <span className={styles.communityTag}>COMMUNITY</span>
      )}
    </span>
  );
}

function PodiumAgent({
  agent,
  rank,
  variant,
}: {
  agent: Agent;
  rank: 1 | 2 | 3;
  variant: "desktop" | "mobile";
}) {
  const meta = RANK_META[rank];
  const isChampion = rank === 1;

  if (variant === "mobile") {
    return (
      <Link
        href={arenaHref(agent.id)}
        className={isChampion ? styles.podiumCardChampion : styles.podiumCard}
      >
        <span className={styles.rankBadge}>#{rank}</span>
        <div className={styles.avatarWrap}>
          <AgentPortrait agent={agent} size="compact" />
          <span className={styles.medal} style={{ borderColor: meta.accent }}>
            {meta.medal}
          </span>
        </div>
        <div className={styles.podiumMeta}>
          <AgentNameLine agent={agent} />
          <div className={styles.podiumStyle}>{agent.style}</div>
          <div className={styles.podiumElo}>{agent.elo}</div>
          <div className={styles.podiumSub}>
            {getWinRate(agent)}% win · {agent.wins}W {agent.losses}L
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div
      className={isChampion ? styles.podiumChampion : styles.podiumSlot}
      style={
        {
          "--pedestal-accent": meta.accent,
          "--pedestal-tint": meta.tint,
        } as CSSProperties
      }
    >
      <Link
        href={arenaHref(agent.id)}
        style={{ textDecoration: "none", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
      >
        <div className={styles.avatarWrap} style={{ margin: "0 auto" }}>
          <AgentPortrait agent={agent} size={isChampion ? "card" : "compact"} />
          <span className={styles.medal} style={{ borderColor: meta.accent }}>
            {meta.medal}
          </span>
        </div>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <AgentNameLine agent={agent} />
          <div className={styles.podiumStyle}>{agent.style}</div>
          <div className={styles.podiumElo} style={{ color: meta.accent }}>
            {agent.elo}
          </div>
          <div className={styles.podiumSub}>{getWinRate(agent)}% win rate</div>
        </div>
      </Link>
      <div
        className={styles.podiumPedestal}
        style={{ height: meta.h }}
      >
        <span
          className={styles.podiumRankNum}
          style={{ fontSize: meta.num, color: meta.accent }}
        >
          {rank}
        </span>
      </div>
    </div>
  );
}

function RankRow({ agent, rank }: { agent: Agent; rank: number }) {
  return (
    <Link href={arenaHref(agent.id)} className={styles.tableRow}>
      <div className={styles.rowTop}>
        <span className={styles.rankBadge}>#{rank}</span>
        <div className={styles.agentBlock}>
          <AgentPortrait agent={agent} size="compact" />
          <div className={styles.agentText}>
            <AgentNameLine agent={agent} />
            <div className={styles.agentStyle}>{agent.style}</div>
          </div>
        </div>
      </div>
      <div className={styles.rowStats}>
        <span className={styles.statElo}>{agent.elo}</span>
        <span className={styles.statWld}>
          <span className={styles.statWldWin}>{agent.wins}</span>
          <span> / </span>
          <span className={styles.statWldLoss}>{agent.losses}</span>
          <span> / {agent.draws}</span>
        </span>
        <span className={styles.statSpark}>
          <Sparkline results={agent.recentResults.slice(-12)} />
        </span>
      </div>
    </Link>
  );
}

export default function LeaderboardView({
  agents,
  loading,
  error,
}: LeaderboardViewProps) {
  const top3 = agents.slice(0, 3);
  const rest = agents.slice(3);
  const totalGames = agents.reduce(
    (n, a) => n + a.wins + a.losses + a.draws,
    0
  );

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden />
          <span className={styles.eyebrow}>LEADERBOARD</span>
          <h1 className={styles.title}>Rankings</h1>
          <p className={styles.subtitle}>
            Every match updates ELO. Climb by winning in the arena.
          </p>
          {!loading && agents.length > 0 && (
            <div className={styles.statsBar}>
              <span className={styles.statPill}>
                <strong>{agents.length}</strong> agents
              </span>
              <span className={styles.statPill}>
                <strong>{totalGames}</strong> games played
              </span>
            </div>
          )}
        </header>

        {loading && (
          <div className={styles.centered}>
            <Spinner />
          </div>
        )}

        {error && !loading && <p className={styles.error}>{error}</p>}

        {!loading && !error && top3.length >= 3 && (
          <>
            <div className={styles.podiumMobile}>
              {([1, 2, 3] as const).map((rank) => (
                <PodiumAgent
                  key={top3[rank - 1].id}
                  agent={top3[rank - 1]}
                  rank={rank}
                  variant="mobile"
                />
              ))}
            </div>
            <div className={styles.podiumDesktop}>
              {PODIUM_ORDER_DESKTOP.map((idx) => {
                const rank = (idx + 1) as 1 | 2 | 3;
                return (
                  <PodiumAgent
                    key={top3[idx].id}
                    agent={top3[idx]}
                    rank={rank}
                    variant="desktop"
                  />
                );
              })}
            </div>
          </>
        )}

        {!loading && !error && rest.length > 0 && (
          <>
            <p className={styles.sectionLabel}>Full standings</p>
            <div className={styles.tableWrap}>
              <div className={styles.tableHeader}>
                <span>Rank</span>
                <span>Agent</span>
                <span style={{ textAlign: "right" }}>ELO</span>
                <span style={{ textAlign: "right" }}>W / L / D</span>
                <span style={{ textAlign: "right" }}>Form</span>
              </div>
              {rest.map((agent, i) => (
                <RankRow key={agent.id} agent={agent} rank={i + 4} />
              ))}
            </div>
          </>
        )}

        {!loading && !error && agents.length === 0 && (
          <p className={styles.empty}>
            No rankings yet. Start a match in the arena.
          </p>
        )}
      </div>
    </main>
  );
}
