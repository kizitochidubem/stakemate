import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { getArchivedMatch } from "@/lib/server/matches";
import { explorerTxUrl } from "@/lib/sui/network";

interface PageProps {
  params: Promise<{ id: string }>;
}

import { buildMatchShareMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const match = await getArchivedMatch(id);
  if (!match) {
    return { title: "Match not found" };
  }

  const winnerName =
    match.result === "white"
      ? match.whiteAgent.name
      : match.result === "black"
        ? match.blackAgent.name
        : null;
  const title = winnerName
    ? `${winnerName} wins · ${match.whiteAgent.name} vs ${match.blackAgent.name}`
    : `Draw · ${match.whiteAgent.name} vs ${match.blackAgent.name}`;

  const description = `${match.moves.length} moves on Stakemate. Watch AI agents battle and wager SUI.`;

  return buildMatchShareMetadata(id, title, description);
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default async function MatchPage({ params }: PageProps) {
  const { id } = await params;
  const match = await getArchivedMatch(id);
  if (!match) notFound();

  const winnerName =
    match.result === "white"
      ? match.whiteAgent.name
      : match.result === "black"
        ? match.blackAgent.name
        : null;
  const loserName =
    match.result === "white"
      ? match.blackAgent.name
      : match.result === "black"
        ? match.whiteAgent.name
        : null;
  const duration =
    match.finishedAt && match.createdAt
      ? formatDuration(match.finishedAt - match.createdAt)
      : null;

  return (
    <>
      <Header />
      <main style={{ background: "var(--bg-primary)", paddingTop: 56, minHeight: "100vh" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.3em",
                color: "var(--accent)",
                display: "block",
                marginBottom: 10,
              }}
            >
              {match.status === "finished" ? "MATCH ARCHIVE" : "MATCH IN PROGRESS"}
            </span>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              {winnerName ? `${winnerName} wins` : "Draw"}
            </h1>
            {loserName && (
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {winnerName} defeats {loserName}
              </p>
            )}
          </div>

          {/* Agents */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 16,
              padding: 24,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <SideCard
              name={match.whiteAgent.name}
              elo={match.whiteAgent.elo}
              side="white"
              isWinner={match.result === "white"}
            />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 700,
                color: "var(--text-muted)",
              }}
            >
              vs
            </span>
            <SideCard
              name={match.blackAgent.name}
              elo={match.blackAgent.elo}
              side="black"
              isWinner={match.result === "black"}
            />
          </div>

          {/* Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1,
              background: "var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 24,
            }}
          >
            <Stat label="Moves" value={String(match.moves.length)} />
            <Stat label="Duration" value={duration ?? "-"} />
            <Stat label="Status" value={match.status} />
          </div>

          {/* On-chain settlement proof */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 18px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {match.settleDigest
                ? "Settled on Sui testnet"
                : "No on-chain wager was settled for this match"}
            </span>
            {match.settleDigest && (
              <a
                href={explorerTxUrl(match.settleDigest)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--accent)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                View tx on Suivision →
              </a>
            )}
          </div>

          {/* Moves */}
          {match.moves.length > 0 && (
            <div
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "var(--text-muted)",
                  marginBottom: 12,
                }}
              >
                FULL MOVE LIST
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  maxHeight: 240,
                  overflowY: "auto",
                }}
              >
                {Array.from({ length: Math.ceil(match.moves.length / 2) }).map((_, i) => {
                  const pair = match.moves.slice(i * 2, i * 2 + 2);
                  return (
                    <span key={i} style={{ whiteSpace: "nowrap" }}>
                      <span style={{ color: "var(--text-muted)" }}>{i + 1}.</span>{" "}
                      <span style={{ color: "var(--text-primary)" }}>{pair[0]}</span>
                      {pair[1] && (
                        <>
                          {" "}
                          <span>{pair[1]}</span>
                        </>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href={`/arena?white=${match.whiteAgent.id}&black=${match.blackAgent.id}`}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                background: "var(--accent)",
                color: "var(--bg-primary)",
                textDecoration: "none",
              }}
            >
              Rematch →
            </Link>
            <Link
              href="/arena"
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                textDecoration: "none",
              }}
            >
              New Match
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function SideCard({
  name,
  elo,
  side,
  isWinner,
}: {
  name: string;
  elo: number;
  side: "white" | "black";
  isWinner: boolean;
}) {
  return (
    <div style={{ textAlign: "center", opacity: isWinner ? 1 : 0.6 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.15em",
          color: "var(--text-muted)",
          display: "block",
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {side}
      </span>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          fontWeight: 700,
          color: isWinner ? "var(--accent)" : "var(--text-primary)",
          marginBottom: 4,
        }}
      >
        {name}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
        ELO {elo}
      </div>
      {isWinner && (
        <span
          style={{
            display: "inline-block",
            marginTop: 8,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(77, 162, 255, 0.12)",
            color: "var(--accent)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.1em",
          }}
        >
          WINNER
        </span>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-secondary)", padding: "16px 8px", textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          fontWeight: 700,
          color: "var(--accent)",
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.15em",
          color: "var(--text-muted)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}
