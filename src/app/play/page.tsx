"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Chess } from "chess.js";
import Header from "@/components/Header";
import Spinner from "@/components/Spinner";
import EvalBar from "@/components/EvalBar";
import AgentCard from "@/components/AgentCard";
import type { Agent } from "@/lib/agents";
import { PLATFORM_AGENTS } from "@/lib/agents";
import { fetchAgentRoster } from "@/lib/agents-client";
import { useToast } from "@/contexts/ToastContext";
import {
  playCapture,
  playCheck,
  playMate,
  playMove,
} from "@/lib/sounds";

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

type Side = "white" | "black";

interface HumanMatchState {
  id: string;
  humanSide: Side;
  agent: Agent;
}

export default function PlayPage() {
  const { push } = useToast();
  const [platformAgents, setPlatformAgents] = useState<Agent[]>(PLATFORM_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<Agent>(PLATFORM_AGENTS[0]);
  const [humanSide, setHumanSide] = useState<Side>("white");
  const [match, setMatch] = useState<HumanMatchState | null>(null);
  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const gameRef = useRef(game);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const roster = await fetchAgentRoster();
        const platform = roster.filter((a) => !a.id.startsWith("custom-"));
        if (cancelled || platform.length === 0) return;
        setPlatformAgents(platform);
        setSelectedAgent((prev) => platform.find((a) => a.id === prev.id) ?? platform[0]);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startMatch = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setResult(null);
    setMoves([]);
    setEvaluation(0);
    try {
      const res = await fetch("/api/match/start-human", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          humanSide,
        }),
      });
      if (!res.ok) throw new Error("Could not start match");
      const data = await res.json();
      const newGame = new Chess(data.fen);
      setGame(newGame);
      gameRef.current = newGame;
      setMatch({
        id: data.id,
        humanSide,
        agent: selectedAgent,
      });
      if (data.agentOpener) {
        setMoves([data.agentOpener]);
      }
      if (typeof data.evaluation === "number") setEvaluation(data.evaluation);
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to start", "error");
    } finally {
      setStarting(false);
    }
  }, [selectedAgent, humanSide, push, starting]);

  const submitHumanMove = useCallback(
    (from: string, to: string): boolean => {
      if (!match || waitingForAgent || result) return false;

      const turn = gameRef.current.turn();
      const humanColor = match.humanSide === "white" ? "w" : "b";
      if (turn !== humanColor) return false;

      const trial = new Chess(gameRef.current.fen());
      let local;
      try {
        local = trial.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!local) return false;

      setSelectedSquare(null);
      setGame(trial);
      gameRef.current = trial;
      setMoves((prev) => [...prev, local.san]);
      if (local.captured) playCapture();
      else playMove();

      setWaitingForAgent(true);
      void (async () => {
        try {
          const res = await fetch(`/api/match/${match.id}/human-move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from, to, promotion: "q" }),
          });
          if (!res.ok) {
            const reverted = new Chess(gameRef.current.fen());
            reverted.undo();
            setGame(reverted);
            gameRef.current = reverted;
            setMoves((prev) => prev.slice(0, -1));
            const data = await res.json().catch(() => ({ error: "Rejected" }));
            push(data.error || "Move rejected", "error");
            return;
          }
          const data = await res.json();
          const finalGame = new Chess(data.fen);
          setGame(finalGame);
          gameRef.current = finalGame;
          if (data.agentMove) {
            setMoves((prev) => [...prev, data.agentMove]);
            if (data.agentCaptured) playCapture();
            else playMove();
            if (data.isCheck && !data.gameOver) playCheck();
          }
          if (typeof data.evaluation === "number") setEvaluation(data.evaluation);
          if (data.gameOver) {
            const winSide = data.result as Side | "draw";
            if (winSide === "draw") {
              setResult("Draw");
            } else if (winSide === match.humanSide) {
              setResult("You win");
              playMate();
            } else {
              setResult(`${match.agent.name} wins`);
              playMate();
            }
          }
        } catch (err) {
          push(err instanceof Error ? err.message : "Network error", "error");
        } finally {
          setWaitingForAgent(false);
        }
      })();

      return true;
    },
    [match, waitingForAgent, result, push]
  );

  const handlePieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }): boolean => {
      if (!targetSquare) return false;
      return submitHumanMove(sourceSquare, targetSquare);
    },
    [submitHumanMove]
  );

  const handleSquareClick = useCallback(
    ({ piece, square }: { piece: { pieceType: string } | null; square: string }) => {
      if (!match || waitingForAgent || result) return;

      const humanColor = match.humanSide === "white" ? "w" : "b";
      const ownsPiece = (pt: string) => pt.length >= 2 && pt[0] === humanColor;

      if (!selectedSquare) {
        if (piece && ownsPiece(piece.pieceType)) setSelectedSquare(square);
        return;
      }

      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      if (submitHumanMove(selectedSquare, square)) return;

      if (piece && ownsPiece(piece.pieceType)) setSelectedSquare(square);
      else setSelectedSquare(null);
    },
    [match, waitingForAgent, result, selectedSquare, submitHumanMove]
  );

  const squareStyles = useMemo(() => {
    if (!selectedSquare) return {};
    return {
      [selectedSquare]: { backgroundColor: "rgba(77, 162, 255, 0.38)" },
    };
  }, [selectedSquare]);

  const resign = () => {
    if (!match) return;
    setResult(`${match.agent.name} wins`);
    push("You resigned", "info");
  };

  const newMatch = () => {
    setMatch(null);
    setGame(new Chess());
    gameRef.current = new Chess();
    setMoves([]);
    setResult(null);
    setEvaluation(0);
  };

  // === Pre-match setup screen ===
  if (!match) {
    return (
      <>
        <Header />
        <main style={{ background: "var(--bg-primary)", paddingTop: 56, minHeight: "100vh" }}>
          <div style={{ maxWidth: 920, margin: "0 auto", padding: "40px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.3em",
                color: "var(--accent)", display: "block", marginBottom: 12,
              }}>
                HUMAN vs AGENT
              </span>
              <h1 style={{
                fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 800,
                color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.025em",
              }}>
                Pick your opponent
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Practice mode · no wagers. For betting, use the{" "}
                <Link href="/arena" style={{ color: "var(--accent)" }}>
                  AI arena
                </Link>
                .
              </p>
            </div>

            {/* Side toggle */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                color: "var(--text-muted)", marginBottom: 8,
              }}>
                YOUR SIDE
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["white", "black"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setHumanSide(s)}
                    style={{
                      flex: 1,
                      padding: "12px 18px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 600,
                      background: humanSide === s ? "var(--bg-tertiary)" : "transparent",
                      border: `1px solid ${humanSide === s ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 8,
                      color: humanSide === s ? "var(--accent)" : "var(--text-secondary)",
                      cursor: "pointer",
                      textTransform: "uppercase",
                    }}
                  >
                    {s === "white" ? "You play White" : "You play Black"}
                  </button>
                ))}
              </div>
            </div>

            {/* Agent grid */}
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
              color: "var(--text-muted)", marginBottom: 8,
            }}>
              OPPONENT
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12,
              marginBottom: 28,
            }}>
              {platformAgents.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  selected={a.id === selectedAgent.id}
                  onClick={() => setSelectedAgent(a)}
                />
              ))}
            </div>

            <button
              onClick={startMatch}
              disabled={starting}
              style={{
                width: "100%",
                padding: "14px 0",
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 700,
                background: "var(--accent)",
                color: "var(--bg-primary)",
                border: "none",
                borderRadius: 10,
                cursor: starting ? "not-allowed" : "pointer",
                opacity: starting ? 0.7 : 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              {starting && <Spinner size={16} color="var(--bg-primary)" />}
              {starting ? "Starting..." : `Play ${selectedAgent.name} as ${humanSide}`}
            </button>
          </div>
        </main>
      </>
    );
  }

  // === In-match screen ===
  return (
    <>
      <Header />
      <main style={{ background: "var(--bg-primary)", paddingTop: 56, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
          {/* Status bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em",
                color: result ? "var(--text-muted)" : "var(--accent)",
              }}>
                {result ? "MATCH ENDED" : waitingForAgent ? `${match.agent.name.toUpperCase()} THINKING...` : "YOUR TURN"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!result && (
                <button
                  onClick={resign}
                  style={{
                    padding: "6px 14px", fontSize: 11, fontFamily: "var(--font-mono)",
                    background: "var(--bg-tertiary)", color: "var(--danger)",
                    border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
                  }}
                >
                  Resign
                </button>
              )}
              <button
                onClick={newMatch}
                style={{
                  padding: "6px 14px", fontSize: 11, fontFamily: "var(--font-mono)",
                  background: "var(--bg-tertiary)", color: "var(--text-primary)",
                  border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
                }}
              >
                New Match
              </button>
            </div>
          </div>

          {/* 3-col layout */}
          <div
            className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_240px]"
            style={{ gap: 16, minWidth: 0 }}
          >
            {/* Left: agent profile */}
            <div className="order-2 lg:order-1" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <AgentCard
                agent={match.agent}
                side={match.humanSide === "white" ? "black" : "white"}
                status={waitingForAgent ? "thinking" : result ? "idle" : "ready"}
              />
              <div style={{
                padding: 16, background: "var(--bg-secondary)",
                border: "1px solid var(--border)", borderRadius: 8,
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
                  color: "var(--text-muted)", display: "block", marginBottom: 6,
                }}>
                  YOU
                </span>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
                  Playing as {match.humanSide}
                </p>
              </div>
            </div>

            {/* Center: board */}
            <div className="order-1 lg:order-2">
              <div style={{ position: "relative" }}>
                {result && (
                  <div
                    style={{
                      position: "absolute", inset: 0, zIndex: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(9, 9, 11, 0.88)", borderRadius: 8,
                    }}
                    className="animate-fade-in"
                  >
                    <div style={{ textAlign: "center" }}>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.3em",
                        color: "var(--text-muted)", display: "block", marginBottom: 8,
                      }}>
                        FINAL
                      </span>
                      <h2 style={{
                        fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 800,
                        color: result.startsWith("You") ? "var(--accent)" : "var(--text-primary)",
                      }}>
                        {result}
                      </h2>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <EvalBar evaluation={evaluation} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Chessboard
                      options={{
                        position: game.fen(),
                        allowDragging: !result && !waitingForAgent,
                        dragActivationDistance: 6,
                        onPieceDrop: handlePieceDrop,
                        onSquareClick: handleSquareClick,
                        squareStyles,
                        boardOrientation: match.humanSide,
                        boardStyle: {
                          borderRadius: "8px",
                          touchAction: "manipulation",
                        },
                        darkSquareStyle: { backgroundColor: "#071428" },
                        lightSquareStyle: { backgroundColor: "#0d2244" },
                        animationDurationInMs: 200,
                        showAnimations: true,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Move list */}
              <div style={{
                marginTop: 14, padding: 16,
                background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8,
              }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
                  color: "var(--text-muted)", marginBottom: 8,
                }}>
                  MOVES · {moves.length}
                </div>
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: "4px 12px",
                  fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)",
                  maxHeight: 100, overflowY: "auto",
                }}>
                  {moves.length === 0 ? (
                    <span style={{ color: "var(--text-muted)" }}>Your move.</span>
                  ) : (
                    Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => {
                      const pair = moves.slice(i * 2, i * 2 + 2);
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
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right: tip card */}
            <div className="order-3" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                padding: 16, background: "var(--bg-secondary)",
                border: "1px solid var(--border)", borderRadius: 8,
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
                  color: "var(--text-muted)", display: "block", marginBottom: 8,
                }}>
                  HOW TO PLAY
                </span>
                <ul style={{ paddingLeft: 18, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  <li>Drag a piece or tap a piece, then tap the destination.</li>
                  <li>Works on mobile (touch) and desktop (mouse).</li>
                  <li>Pawn promotions auto-queen.</li>
                  <li>Refreshing loses the in-memory match · start a new game.</li>
                  <li>No SUI wagers here; arena only.</li>
                </ul>
              </div>
              <Link
                href="/arena"
                style={{
                  padding: "10px 14px", fontSize: 12, fontWeight: 600,
                  background: "var(--bg-tertiary)", color: "var(--text-secondary)",
                  border: "1px solid var(--border)", borderRadius: 8,
                  textAlign: "center", textDecoration: "none",
                }}
              >
                Watch AI vs AI →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
