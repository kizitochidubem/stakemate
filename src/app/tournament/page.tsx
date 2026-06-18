"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Spinner from "@/components/Spinner";
import type { Agent } from "@/lib/agents";
import { fetchAgentRoster } from "@/lib/agents-client";
import { nextMove, startMatch } from "@/lib/match-client";

type Round = "Quarterfinal" | "Semifinal" | "Final";

interface BracketMatch {
  id: string;
  round: Round;
  position: number;
  whiteAgent: Agent;
  blackAgent: Agent;
  matchServerId: string | null;
  result: "white" | "black" | "draw" | null;
  status: "pending" | "running" | "finished";
  moveCount: number;
}

const cx: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "0 24px" };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildInitialBracket(agents: Agent[]): BracketMatch[] {
  const seeded = shuffle(agents).slice(0, 8);
  const quarter: BracketMatch[] = [];
  for (let i = 0; i < 4; i++) {
    quarter.push({
      id: `qf-${i}`,
      round: "Quarterfinal",
      position: i,
      whiteAgent: seeded[i * 2],
      blackAgent: seeded[i * 2 + 1],
      matchServerId: null,
      result: null,
      status: "pending",
      moveCount: 0,
    });
  }
  return quarter;
}

export default function TournamentPage() {
  const [bracket, setBracket] = useState<BracketMatch[]>([]);
  const [running, setRunning] = useState(false);
  const [champion, setChampion] = useState<Agent | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const roster = await fetchAgentRoster();
        const platform = roster.filter((a) => !a.id.startsWith("custom-"));
        const pool = platform.length >= 8 ? platform : roster;
        if (!cancelled && pool.length >= 2) {
          setBracket(buildInitialBracket(pool.slice(0, 8)));
        }
      } catch {
        /* empty bracket */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Drives a single bracket match to completion via the server API. */
  const playMatch = useCallback(async (m: BracketMatch): Promise<Agent | "draw"> => {
    // Start it
    const started = await startMatch(m.whiteAgent.id, m.blackAgent.id);
    setBracket((prev) =>
      prev.map((x) =>
        x.id === m.id ? { ...x, matchServerId: started.id, status: "running" } : x
      )
    );

    // Poll until finished
    while (runningRef.current) {
      const data = await nextMove(started.id);
      setBracket((prev) =>
        prev.map((x) =>
          x.id === m.id
            ? { ...x, moveCount: data.moveCount ?? x.moveCount }
            : x
        )
      );
      if (data.gameOver) {
        const winner =
          data.result === "white"
            ? m.whiteAgent
            : data.result === "black"
              ? m.blackAgent
              : "draw" as const;
        setBracket((prev) =>
          prev.map((x) =>
            x.id === m.id
              ? { ...x, status: "finished", result: data.result }
              : x
          )
        );
        return winner;
      }
      // Tiny breather between move polls
      await new Promise((r) => setTimeout(r, 180));
    }
    return "draw";
  }, []);

  const runTournament = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setChampion(null);
    const roster = await fetchAgentRoster();
    const platform = roster.filter((a) => !a.id.startsWith("custom-"));
    const pool = platform.length >= 8 ? platform : roster;
    const initial = buildInitialBracket(pool.slice(0, 8));
    setBracket(initial);

    try {
      // QUARTERFINALS - play them sequentially so the UI feels broadcasted
      const qWinners: Agent[] = [];
      for (const m of initial) {
        const w = await playMatch(m);
        // Draws fall back to higher ELO progressing
        const adv =
          w === "draw"
            ? m.whiteAgent.elo >= m.blackAgent.elo
              ? m.whiteAgent
              : m.blackAgent
            : w;
        qWinners.push(adv);
        if (!runningRef.current) return;
      }

      // SEMIFINALS
      const semis: BracketMatch[] = [];
      for (let i = 0; i < 2; i++) {
        semis.push({
          id: `sf-${i}`,
          round: "Semifinal",
          position: i,
          whiteAgent: qWinners[i * 2],
          blackAgent: qWinners[i * 2 + 1],
          matchServerId: null,
          result: null,
          status: "pending",
          moveCount: 0,
        });
      }
      setBracket((prev) => [...prev, ...semis]);

      const sWinners: Agent[] = [];
      for (const m of semis) {
        const w = await playMatch(m);
        const adv =
          w === "draw"
            ? m.whiteAgent.elo >= m.blackAgent.elo
              ? m.whiteAgent
              : m.blackAgent
            : w;
        sWinners.push(adv);
        if (!runningRef.current) return;
      }

      // FINAL
      const final: BracketMatch = {
        id: "final",
        round: "Final",
        position: 0,
        whiteAgent: sWinners[0],
        blackAgent: sWinners[1],
        matchServerId: null,
        result: null,
        status: "pending",
        moveCount: 0,
      };
      setBracket((prev) => [...prev, final]);

      const champ = await playMatch(final);
      const champAgent =
        champ === "draw"
          ? final.whiteAgent.elo >= final.blackAgent.elo
            ? final.whiteAgent
            : final.blackAgent
          : champ;
      setChampion(champAgent);
    } catch (err) {
      console.error("Tournament failed:", err);
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [playMatch]);

  const stopTournament = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  const grouped: Record<Round, BracketMatch[]> = {
    Quarterfinal: bracket.filter((b) => b.round === "Quarterfinal"),
    Semifinal: bracket.filter((b) => b.round === "Semifinal"),
    Final: bracket.filter((b) => b.round === "Final"),
  };

  return (
    <>
      <Header />
      <main style={{ background: "var(--bg-primary)", paddingTop: 56, minHeight: "100vh" }}>
        <div style={{ ...cx, paddingTop: 40, paddingBottom: 48 }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
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
              TOURNAMENT
            </span>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 36,
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: 8,
                letterSpacing: "-0.025em",
              }}
            >
              8-Agent Knockout
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
              Quarterfinals, semifinals, final. Last agent standing wins.
            </p>

            {/* Run / stop */}
            {!running ? (
              <button
                onClick={runTournament}
                style={{
                  padding: "12px 28px",
                  fontFamily: "var(--font-display)",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "var(--accent)",
                  color: "var(--bg-primary)",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {champion ? "Run Another Tournament" : "Start Tournament"}
              </button>
            ) : (
              <button
                onClick={stopTournament}
                style={{
                  padding: "12px 28px",
                  fontFamily: "var(--font-display)",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "var(--danger)",
                  color: "var(--text-primary)",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Spinner size={14} color="var(--text-primary)" />
                Stop Tournament
              </button>
            )}
          </div>

          {/* Champion banner */}
          {champion && (
            <div
              style={{
                padding: 24,
                marginBottom: 28,
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(77, 162, 255, 0.1) 0%, rgba(77, 162, 255, 0.02) 100%)",
                border: "1px solid var(--accent)",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.3em",
                  color: "var(--accent)",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                CHAMPION
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 32,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.025em",
                }}
              >
                {champion.name}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                ELO {champion.elo} · {champion.style}
              </p>
            </div>
          )}

          {/* Bracket */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              alignItems: "start",
            }}
            className="bracket-grid"
          >
            <RoundColumn title="Quarterfinals" matches={grouped.Quarterfinal} />
            <RoundColumn title="Semifinals" matches={grouped.Semifinal} />
            <RoundColumn title="Final" matches={grouped.Final} />
          </div>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <Link
              href="/leaderboard"
              style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}
            >
              View Leaderboard ·
            </Link>{" "}
            <Link
              href="/arena"
              style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", marginLeft: 8 }}
            >
              Watch Single Match ·
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function RoundColumn({ title, matches }: { title: string; matches: BracketMatch[] }) {
  return (
    <div>
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.2em",
          color: "var(--text-muted)",
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {matches.length === 0 ? (
          <div
            style={{
              padding: 16,
              background: "var(--bg-secondary)",
              border: "1px dashed var(--border)",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            Awaiting winners
          </div>
        ) : (
          matches.map((m) => <BracketMatchCard key={m.id} match={m} />)
        )}
      </div>
    </div>
  );
}

function BracketMatchCard({ match }: { match: BracketMatch }) {
  const whiteWon = match.result === "white";
  const blackWon = match.result === "black";

  const isRunning = match.status === "running";

  return (
    <div
      style={{
        padding: 14,
        background: "var(--bg-secondary)",
        border: `1px solid ${isRunning ? "var(--accent-dim)" : "var(--border)"}`,
        borderRadius: 10,
        boxShadow: isRunning ? "0 0 16px rgba(77, 162, 255, 0.15)" : "none",
        transition: "all 0.3s",
      }}
    >
      <Row
        agent={match.whiteAgent}
        isWinner={whiteWon}
        side="W"
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: isRunning ? "var(--accent)" : "var(--text-muted)",
            letterSpacing: "0.1em",
          }}
        >
          {match.status === "pending"
            ? "VS"
            : match.status === "running"
              ? `MOVE ${match.moveCount}`
              : match.result === "draw"
                ? "DRAW"
                : "FINAL"}
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
      <Row
        agent={match.blackAgent}
        isWinner={blackWon}
        side="B"
      />
    </div>
  );
}

function Row({
  agent,
  isWinner,
  side,
}: {
  agent: Agent;
  isWinner: boolean;
  side: "W" | "B";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        opacity: isWinner ? 1 : 0.85,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          background: side === "W" ? "var(--text-primary)" : "var(--bg-tertiary)",
          color: side === "W" ? "var(--bg-primary)" : "var(--text-primary)",
          border: side === "B" ? "1px solid var(--border)" : "none",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {side}
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-display)",
          fontSize: 13,
          fontWeight: isWinner ? 700 : 500,
          color: isWinner ? "var(--accent)" : "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {agent.name}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        {agent.elo}
      </span>
    </div>
  );
}
