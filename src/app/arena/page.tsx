"use client";

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import Header from "@/components/Header";
import AgentCard from "@/components/AgentCard";
import EvalBar from "@/components/EvalBar";
import WagerPanel from "@/components/WagerPanel";
import CapturedGraveyard from "@/components/CapturedGraveyard";
import SettlementCard from "@/components/SettlementCard";
import AgentSelectModal from "@/components/AgentSelectModal";
import Spinner from "@/components/Spinner";
import { PLATFORM_AGENTS, type Agent } from "@/lib/agents";
import {
  fetchAgentRoster,
  fetchAgentsByIds,
  mergeLiveStats,
} from "@/lib/agents-client";
import { calculateOdds } from "@/lib/match";
import { getCapturedByWhite, getCapturedByBlack } from "@/lib/captured-pieces";
import { useWager } from "@/contexts/WagerContext";
import { useToast } from "@/contexts/ToastContext";
import { startMatch as startMatchAPI, nextMove } from "@/lib/match-client";
import { sendWager } from "@/lib/wager";
import { SUI_CHAIN } from "@/lib/chains";
import { isEscrowEnabled, type SignAndExecute } from "@/lib/escrow-sui/client";
import { fetchOnChainWagerState } from "@/lib/escrow-sui/account-state";
import { friendlyEscrowError } from "@/lib/escrow-sui/error-messages";
import { claimEscrowPayout, settleEscrowMatch } from "@/lib/escrow-sui/settle";
import {
  clearArenaSession,
  loadArenaSession,
  persistArenaSession,
} from "@/lib/arena-session";
import {
  clearPersistedWager,
  loadPersistedWager,
  persistActiveWager,
  type PersistedWager,
} from "@/lib/wager-persist";
import WagerRecoveryBanner from "@/components/WagerRecoveryBanner";
import { trackWagerPlaced, trackWagerSettled } from "@/components/UserTracker";
import { freshArenaMatchId } from "@/lib/arena-match-id";
import { shareTweetUrl } from "@/lib/share";
import {
  captureLine,
  checkLine,
  drawLine,
  mateLine,
  swingLine,
} from "@/lib/commentary";
import {
  playCapture,
  playCheck,
  playMate,
  playMove,
  playWager,
  loadSoundPreference,
  setSoundEnabled,
} from "@/lib/sounds";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="loading-bar" style={{ width: 128 }} />
      </div>
    ),
  }
);

function ArenaContent() {
  const searchParams = useSearchParams();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { push } = useToast();
  const {
    activeWager,
    lastSettlement,
    placeWager,
    settleMatch,
    clearActiveWager,
    clearSettlement,
    patchLastSettlement,
  } = useWager();
  const [wagering, setWagering] = useState(false);
  const [claimingPayout, setClaimingPayout] = useState(false);
  const [startingMatch, setStartingMatch] = useState(false);
  const [recoveryWager, setRecoveryWager] = useState<PersistedWager | null>(null);
  const [recoveryMatch, setRecoveryMatch] = useState<{
    status: "live" | "finished" | "missing";
    result: "white" | "black" | "draw" | null;
  } | null>(null);

  const signAndExecute: SignAndExecute = useCallback(
    async (tx) => {
      const result = await signAndExecuteTransaction({ transaction: tx });
      return { digest: result.digest };
    },
    [signAndExecuteTransaction]
  );

  const initialWhite = PLATFORM_AGENTS[0];
  const initialBlack = PLATFORM_AGENTS[1];

  const [game, setGame] = useState(new Chess());
  const [whiteAgent, setWhiteAgent] = useState<Agent>(initialWhite);
  const [blackAgent, setBlackAgent] = useState<Agent>(initialBlack);
  const [isPlaying, setIsPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [evaluation, setEvaluation] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [resultWinner, setResultWinner] = useState<
    "white" | "black" | "draw" | null
  >(null);
  const [shaking, setShaking] = useState(false);
  const [pool, setPool] = useState(0);
  const [selectingFor, setSelectingFor] = useState<"white" | "black" | null>(
    null
  );
  const gameRef = useRef(game);
  const playingRef = useRef(false);
  const matchIdRef = useRef(freshArenaMatchId());
  const activeWagerRef = useRef(activeWager);
  const lastEvalRef = useRef(0);
  const [soundOn, setSoundOn] = useState(false);
  const [matchStartedAt, setMatchStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // Snapshot of the match id whose result is on screen. matchIdRef gets
  // reassigned to a fresh id by beginNewArenaRound() right after a match
  // ends, so the "View Match" link must not read the live ref.
  const [finishedMatchId, setFinishedMatchId] = useState<string | null>(null);

  useEffect(() => {
    setSoundOn(loadSoundPreference());
  }, []);

  // Live timer · only ticks while playing AND not paused
  useEffect(() => {
    if (!matchStartedAt || !isPlaying || paused) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - matchStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [matchStartedAt, isPlaying, paused]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
  };

  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    activeWagerRef.current = activeWager;
  }, [activeWager]);

  // Restore persisted wager / match id after refresh (wallet is the user id)
  useEffect(() => {
    if (!account || activeWager) return;
    const wallet = account.address;
    const saved = loadPersistedWager(wallet);
    if (!saved?.signature) return;

    const session = loadArenaSession(wallet);
    if (session?.matchId) matchIdRef.current = session.matchId;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/match/${saved.matchId}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as {
            status: string;
            result: "white" | "black" | "draw" | null;
          };
          setRecoveryWager(saved);
          setRecoveryMatch({
            status: data.status === "finished" ? "finished" : "live",
            result: data.result,
          });
        } else {
          setRecoveryWager(saved);
          setRecoveryMatch({ status: "missing", result: null });
        }
      } catch {
        if (!cancelled) {
          setRecoveryWager(saved);
          setRecoveryMatch({ status: "missing", result: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, activeWager]);

  useEffect(() => {
    const w = searchParams.get("white");
    const b = searchParams.get("black");

    let cancelled = false;
    (async () => {
      try {
        const roster = await fetchAgentRoster();
        if (cancelled) return;
        const find = (id: string | null) =>
          id ? roster.find((a) => a.id === id) : undefined;
        const white = find(w) ?? roster[0];
        const black = find(b) ?? roster[1] ?? roster[0];
        if (white) setWhiteAgent(white);
        if (black && black.id !== white?.id) setBlackAgent(black);
        else if (roster[1]) setBlackAgent(roster[1]);
      } catch {
        /* keep current selection */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const capturedWhite = useMemo(() => getCapturedByWhite(game), [game]);
  const capturedBlack = useMemo(() => getCapturedByBlack(game), [game]);

  /** New on-chain match + wager slot (one wager per match+wallet). */
  const beginNewArenaRound = useCallback(() => {
    matchIdRef.current = freshArenaMatchId();
    clearActiveWager();
    clearPersistedWager();
    if (account) clearArenaSession();
  }, [clearActiveWager, account]);

  /**
   * Poll the server for the next move. The chess engine runs server-side
   * · we just receive the new FEN and apply it locally for rendering.
   */
  const fetchNextMove = useCallback(async () => {
    if (!playingRef.current) return;
    const matchId = matchIdRef.current;
    if (!matchId) return;

    try {
      const data = await nextMove(matchId);

      // Apply the new board state
      const newGame = new Chess(data.fen);
      setGame(newGame);
      gameRef.current = newGame;

      const moverIsWhite = newGame.turn() === "b"; // just moved
      const mover = moverIsWhite ? whiteAgent : blackAgent;
      const opponent = moverIsWhite ? blackAgent : whiteAgent;

      if (data.move) {
        setMoves((prev) => [...prev, data.move!]);
        if (typeof data.evaluation === "number") {
          // Detect a >2 pawn swing · surface commentary
          const swing = Math.abs(data.evaluation - lastEvalRef.current);
          if (swing > 2 && newGame.moveNumber() > 6) {
            const leader = data.evaluation > 0 ? whiteAgent.name : blackAgent.name;
            push(swingLine(leader), "info");
          }
          lastEvalRef.current = data.evaluation;
          setEvaluation(data.evaluation);
        }

        // Sound effects
        if (data.captured) playCapture();
        else playMove();
        if (data.isCheck) playCheck();

        // Commentary: only fire on impactful moves to avoid spam
        if (data.captured) {
          push(captureLine(mover.name, data.captured), "info");
        }
        if (data.isCheck && !data.gameOver) {
          push(checkLine(mover.name, opponent.name), "info");
        }

        if (data.captured) {
          setShaking(true);
          setTimeout(() => setShaking(false), 100);
        }
      }

      if (data.gameOver) {
        playingRef.current = false;
        setIsPlaying(false);
        setFinishedMatchId(matchIdRef.current);
        const winner = (data.result ?? "draw") as "white" | "black" | "draw";
        if (winner === "draw") {
          setResult(data.reason === "move-cap" ? "Draw · Move Limit" : "Draw");
          push(drawLine(data.reason), "info");
        } else {
          const winnerAgent = winner === "white" ? whiteAgent : blackAgent;
          const loserAgent = winner === "white" ? blackAgent : whiteAgent;
          setResult(`${winnerAgent.name} wins`);
          push(mateLine(winnerAgent.name, loserAgent.name), "success");
          playMate();
        }
        setResultWinner(winner);
        const wager = activeWagerRef.current;
        const escrowReady =
          Boolean(wager?.signature) && isEscrowEnabled() && Boolean(account);

        if (escrowReady) {
          try {
            await settleEscrowMatch(wager!.matchId, winner);
            const backedWin =
              (winner === "white" && wager!.side === "white") ||
              (winner === "black" && wager!.side === "black");
            const outcome =
              winner === "draw" ? "refund" : backedWin ? "won" : "lost";

            settleMatch(winner, whiteAgent.name, blackAgent.name);

            if (outcome === "won" || outcome === "refund") {
              patchLastSettlement({
                claimPending: true,
                claimMatchId: wager!.matchId,
              });
              push(
                outcome === "refund"
                  ? "Draw settled · tap Claim to get your stake back"
                  : "You won · tap Claim payout when ready",
                "success"
              );
            } else {
              void trackWagerSettled({
                wallet: account!.address,
                matchId: wager!.matchId,
                outcome: "lost",
              });
              push("Wager lost · stake went to the winning side", "info");
            }
          } catch (err) {
            console.error("Escrow settle failed:", err);
            settleMatch(winner, whiteAgent.name, blackAgent.name);
            push(
              friendlyEscrowError(err) +
              " Try “Claim refund” on the recovery banner if needed.",
              "error"
            );
          }
        } else {
          settleMatch(winner, whiteAgent.name, blackAgent.name);
          const walletKey = account?.address;
          if (wager?.signature && walletKey) {
            const outcome =
              winner === "draw"
                ? "refund"
                : (winner === "white" && wager.side === "white") ||
                  (winner === "black" && wager.side === "black")
                  ? "won"
                  : "lost";
            void trackWagerSettled({
              wallet: walletKey,
              matchId: wager.matchId,
              outcome,
            });
          }
        }
        beginNewArenaRound();

        const whiteId = whiteAgent.id;
        const blackId = blackAgent.id;
        void fetchAgentsByIds(whiteId, blackId)
          .then(({ white, black }) => {
            if (white) setWhiteAgent((prev) => mergeLiveStats(prev, white));
            if (black) setBlackAgent((prev) => mergeLiveStats(prev, black));
          })
          .catch(() => {
            /* odds stay on last known ELO until next roster load */
          });

        return;
      }

      // Schedule next move
      setTimeout(() => void fetchNextMove(), 250 + Math.random() * 150);
    } catch (err) {
      console.error("Move failed:", err);
      push("Move failed · server error", "error");
      playingRef.current = false;
      setIsPlaying(false);
    }
  }, [
    whiteAgent,
    blackAgent,
    settleMatch,
    patchLastSettlement,
    push,
    account,
    beginNewArenaRound,
  ]);

  const startMatch = useCallback(async () => {
    if (startingMatch) return;
    setStartingMatch(true);
    clearSettlement();
    const newGame = new Chess();
    setGame(newGame);
    gameRef.current = newGame;
    setMoves([]);
    setResult(null);
    setResultWinner(null);
    setFinishedMatchId(null);
    setEvaluation(0);
    lastEvalRef.current = 0;
    setMatchStartedAt(Date.now());
    setElapsed(0);
    setPaused(false);

    try {
      // Start the match server-side
      const match = await startMatchAPI(
        whiteAgent.id,
        blackAgent.id,
        matchIdRef.current
      );
      matchIdRef.current = match.id;
      if (account) {
        persistArenaSession(account.address, match.id);
      }
      setIsPlaying(true);
      playingRef.current = true;
      setPool((p) => Math.round((p + (activeWager?.amount ?? 0)) * 10) / 10);
      setTimeout(() => void fetchNextMove(), 200);
    } catch (err) {
      console.error("Start match failed:", err);
      push("Could not start match", "error");
    } finally {
      setStartingMatch(false);
    }
  }, [
    whiteAgent.id,
    blackAgent.id,
    fetchNextMove,
    clearSettlement,
    activeWager?.amount,
    push,
    startingMatch,
    account,
    result,
  ]);

  const stopMatch = useCallback(() => {
    if (activeWager) {
      push(
        "Can't stop · your wager is locked. Let the match finish.",
        "error"
      );
      return;
    }
    setIsPlaying(false);
    setPaused(false);
    playingRef.current = false;
  }, [activeWager, push]);

  /** Freeze the broadcast: stop polling but keep all state. */
  const pauseMatch = useCallback(() => {
    if (!isPlaying || paused) return;
    playingRef.current = false;
    setPaused(true);
  }, [isPlaying, paused]);

  /** Continue from where we paused. Adjusts matchStartedAt so the timer
   * picks up at the value it was showing when paused. */
  const resumeMatch = useCallback(() => {
    if (!isPlaying || !paused) return;
    if (matchStartedAt) {
      setMatchStartedAt(Date.now() - elapsed * 1000);
    }
    playingRef.current = true;
    setPaused(false);
    setTimeout(() => void fetchNextMove(), 150);
  }, [isPlaying, paused, matchStartedAt, elapsed, fetchNextMove]);

  const selectAgent = (agent: Agent) => {
    if (selectingFor === "white") {
      if (agent.id !== blackAgent.id) setWhiteAgent(agent);
    } else if (selectingFor === "black") {
      if (agent.id !== whiteAgent.id) setBlackAgent(agent);
    }
    setSelectingFor(null);
  };

  const odds = calculateOdds(whiteAgent, blackAgent);

  const handlePlaceWager = async (side: "white" | "black", amount: number) => {
    if (!account) {
      push("Connect wallet to place a wager", "error");
      return;
    }

    if (isPlaying) {
      push("Wait for the match to end", "error");
      return;
    }
    if (result) {
      setResult(null);
      setResultWinner(null);
    }
    if (wagering) return;

    const agent = side === "white" ? whiteAgent : blackAgent;
    const sideOdds = side === "white" ? odds.white : odds.black;

    setWagering(true);
    push("Confirm the transaction in your wallet...", "info");

    try {
      // Proactive guard: if this (matchId, wallet) already has a wager
      // on-chain, the Move package's EWagerExists abort will reject the
      // new tx. Rotate to a fresh match id and let the user re-confirm so
      // the wallet popup doesn't even happen for a doomed tx.
      if (isEscrowEnabled()) {
        const existing = await fetchOnChainWagerState(
          client,
          matchIdRef.current,
          account.address
        );
        if (existing.exists) {
          beginNewArenaRound();
          push(
            "This wallet already wagered on the previous match. Click again for the next round.",
            "info"
          );
          return;
        }
      }

      const receipt = await sendWager(
        client,
        account.address,
        amount,
        signAndExecute,
        matchIdRef.current,
        side,
        sideOdds
      );

      placeWager({
        matchId: matchIdRef.current,
        side,
        amount,
        agentName: agent.name,
        odds: sideOdds,
        signature: receipt.digest,
        explorerUrl: receipt.explorerUrl,
      });
      persistActiveWager(account.address, {
        matchId: matchIdRef.current,
        side,
        amount,
        agentName: agent.name,
        odds: sideOdds,
        signature: receipt.digest,
        explorerUrl: receipt.explorerUrl,
      });
      persistArenaSession(account.address, matchIdRef.current);

      void trackWagerPlaced({
        wallet: account.address,
        signature: receipt.digest,
        matchId: matchIdRef.current,
        amount,
        side,
        agentName: agent.name,
      });

      playWager();
      push(`${amount} ${SUI_CHAIN.asset} on ${agent.name} · confirmed`, "success");
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const isUserCancel = /User rejected|rejected the request/i.test(raw);
      const friendly = friendlyEscrowError(err);
      console.error("Wager failed:", err);
      const alreadyWagered = /rotated to a fresh slot/i.test(friendly);
      push(
        isUserCancel
          ? "Wager cancelled"
          : alreadyWagered
            ? "You already wagered on this match. We rotated to a fresh slot · click again."
            : friendly,
        "error"
      );
      if (alreadyWagered) beginNewArenaRound();
    } finally {
      setWagering(false);
    }
  };

  const handleClaimPayout = useCallback(async () => {
    if (!lastSettlement?.claimPending || !lastSettlement.claimMatchId || !account) {
      return;
    }
    setClaimingPayout(true);
    push("Confirm the claim in your wallet…", "info");
    try {
      const claim = await claimEscrowPayout(
        client,
        account.address,
        lastSettlement.claimMatchId,
        signAndExecute
      );
      const outcome = lastSettlement.outcome;
      patchLastSettlement({
        claimPending: false,
        signature: claim.digest,
        explorerUrl: claim.explorerUrl,
      });
      void trackWagerSettled({
        wallet: account.address,
        matchId: lastSettlement.claimMatchId,
        outcome: outcome === "refund" ? "refund" : "won",
      });
      clearPersistedWager();
      clearArenaSession();
      push(
        outcome === "refund"
          ? `${lastSettlement.stake} ${SUI_CHAIN.asset} returned to your wallet`
          : "Payout sent to your wallet",
        "success"
      );
    } catch (err) {
      push(friendlyEscrowError(err), "error");
    } finally {
      setClaimingPayout(false);
    }
  }, [account, client, lastSettlement, patchLastSettlement, push, signAndExecute]);

  const movePairs: string[][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push(moves.slice(i, i + 2));
  }

  return (
    <>
      <Header />
      <main style={{ background: "var(--bg-primary)", paddingTop: 56, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 16px", minWidth: 0 }}>
          {/* Status bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                className={isPlaying && !paused ? "animate-gold-pulse" : ""}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isPlaying
                    ? paused
                      ? "var(--text-secondary)"
                      : "var(--accent)"
                    : "var(--text-muted)",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  letterSpacing: "0.15em",
                  color: isPlaying
                    ? paused
                      ? "var(--text-secondary)"
                      : "var(--accent)"
                    : "var(--text-muted)",
                }}
              >
                {isPlaying
                  ? paused
                    ? "PAUSED"
                    : "MATCH LIVE"
                  : result
                    ? "MATCH ENDED"
                    : "READY"}
              </span>
              {/* Playtime tracker */}
              {(isPlaying || elapsed > 0) && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontVariantNumeric: "tabular-nums",
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                  }}
                  title="Match playtime"
                >
                  {formatElapsed(elapsed)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Network badge */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                  color: "var(--success)",
                  textTransform: "uppercase",
                }}
              >
                {SUI_CHAIN.label}
              </span>
              {/* Live advantage indicator */}
              {isPlaying && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color:
                      Math.abs(evaluation) < 0.5
                        ? "var(--text-muted)"
                        : "var(--accent)",
                  }}
                  title="Current chess engine evaluation. Positive = white winning, negative = black winning."
                >
                  {Math.abs(evaluation) < 0.5
                    ? "even"
                    : `${evaluation > 0 ? whiteAgent.name : blackAgent.name} +${Math.abs(evaluation).toFixed(1)}`}
                </span>
              )}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: pool > 0 ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {pool > 0
                  ? `${pool.toFixed(2)} ${SUI_CHAIN.asset} pool`
                  : "No wagers yet"}
              </span>
              {/* Sound toggle */}
              <button
                type="button"
                onClick={toggleSound}
                title={soundOn ? "Sound on · click to mute" : "Sound off · click to enable"}
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: soundOn ? "var(--bg-tertiary)" : "transparent",
                  color: soundOn ? "var(--accent)" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                {soundOn ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Main grid */}
          <div
            className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_280px]"
            style={{ gap: 16, minWidth: 0 }}
          >
            {/* LEFT: Agents */}
            <div className="order-2 lg:order-1" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* White agent */}
              <div style={{ position: "relative" }}>
                <AgentCard
                  agent={whiteAgent}
                  side="white"
                  selected={activeWager?.side === "white"}
                  onClick={() =>
                    !isPlaying && setSelectingFor("white")
                  }
                />
                {!isPlaying && (
                  <button
                    type="button"
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.15em",
                      padding: "4px 8px",
                      transition: "all 0.2s",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-muted)",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectingFor("white")}
                  >
                    SWAP
                  </button>
                )}
              </div>

              <CapturedGraveyard captured={capturedWhite} side="white" label="CAPTURED BY WHITE" />

              {/* VS divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                  }}
                >
                  VS
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              {/* Black agent */}
              <div style={{ position: "relative" }}>
                <AgentCard
                  agent={blackAgent}
                  side="black"
                  selected={activeWager?.side === "black"}
                  onClick={() =>
                    !isPlaying && setSelectingFor("black")
                  }
                />
                {!isPlaying && (
                  <button
                    type="button"
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.15em",
                      padding: "4px 8px",
                      transition: "all 0.2s",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-muted)",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectingFor("black")}
                  >
                    SWAP
                  </button>
                )}
              </div>

              <CapturedGraveyard captured={capturedBlack} side="black" label="CAPTURED BY BLACK" />

              {/* Match controls */}
              <div style={{ paddingTop: 12 }}>
                {!isPlaying ? (
                  <button
                    type="button"
                    onClick={startMatch}
                    disabled={startingMatch}
                    style={{
                      width: "100%",
                      padding: "14px 0",
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      transition: "all 0.3s",
                      background: "var(--accent)",
                      color: "var(--bg-primary)",
                      border: "none",
                      borderRadius: 8,
                      cursor: startingMatch ? "not-allowed" : "pointer",
                      opacity: startingMatch ? 0.7 : 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                  >
                    {startingMatch && <Spinner size={16} color="var(--bg-primary)" />}
                    {startingMatch ? "Starting..." : result ? "Rematch" : "Start Match"}
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={paused ? resumeMatch : pauseMatch}
                      title={paused ? "Resume polling" : "Pause polling"}
                      style={{
                        flex: 1,
                        padding: "14px 0",
                        fontFamily: "var(--font-display)",
                        fontSize: 16,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        transition: "all 0.2s",
                        background: paused ? "var(--accent)" : "var(--bg-tertiary)",
                        color: paused ? "var(--bg-primary)" : "var(--text-primary)",
                        border: paused ? "none" : "1px solid var(--border)",
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {paused ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <rect x="6" y="5" width="4" height="14" rx="1" />
                          <rect x="14" y="5" width="4" height="14" rx="1" />
                        </svg>
                      )}
                      {paused ? "Resume" : "Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={stopMatch}
                      title={
                        activeWager
                          ? "Wager is locked, let the match finish"
                          : "End the match now"
                      }
                      style={{
                        padding: "14px 18px",
                        fontFamily: "var(--font-display)",
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        transition: "all 0.2s",
                        background: "transparent",
                        color: "var(--danger)",
                        border: "1px solid var(--danger)",
                        borderRadius: 8,
                        cursor: "pointer",
                        opacity: activeWager ? 0.5 : 1,
                      }}
                    >
                      Stop
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* CENTER: Board */}
            <div className="order-1 lg:order-2">
              <div className={shaking ? "animate-shake" : ""} style={{ position: "relative" }}>
                {/* Result overlay */}
                {result && (
                  <div
                    className="animate-fade-in"
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(3, 10, 26, 0.92)",
                    }}
                  >
                    <div className="animate-slide-up" style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          letterSpacing: "0.3em",
                          marginBottom: 12,
                          color: "var(--text-muted)",
                        }}
                      >
                        MATCH SETTLED
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 48,
                          fontWeight: 700,
                          marginBottom: 16,
                          color: "var(--accent)",
                        }}
                      >
                        {result}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 14,
                          color: "var(--text-secondary)",
                          marginBottom: 16,
                        }}
                      >
                        {moves.length} moves &middot; {formatElapsed(elapsed)}
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <a
                          href={`/match/${finishedMatchId ?? matchIdRef.current}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "8px 16px",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            background: "var(--bg-tertiary)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                            textDecoration: "none",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          View Match →
                        </a>
                        {result && (
                          <a
                            href={shareTweetUrl(
                              finishedMatchId ?? matchIdRef.current,
                              result,
                              whiteAgent.name,
                              blackAgent.name
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "8px 16px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              background: "var(--bg-tertiary)",
                              color: "var(--text-primary)",
                              border: "1px solid var(--border)",
                              textDecoration: "none",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            Share →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Board + eval bar */}
                <div style={{ display: "flex", gap: 8 }}>
                  <EvalBar evaluation={evaluation} />
                  <div style={{ flex: 1, position: "relative" }}>
                    <Chessboard
                      options={{
                        position: game.fen(),
                        allowDragging: false,
                        boardStyle: { borderRadius: "0px" },
                        darkSquareStyle: { backgroundColor: "#071428" },
                        lightSquareStyle: { backgroundColor: "#0d2244" },
                        animationDurationInMs: 200,
                        showAnimations: true,
                      }}
                    />
                    {isPlaying && (
                      <div className="board-vignette" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Move log */}
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.2em",
                      color: "var(--text-muted)",
                    }}
                  >
                    MOVES
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--text-muted)",
                    }}
                  >
                    {moves.length} total
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", columnGap: 16, rowGap: 6, maxHeight: 112, overflowY: "auto" }}>
                  {movePairs.map((pair, i) => (
                    <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "nowrap" }}>
                      <span style={{ color: "var(--text-muted)" }}>
                        {i + 1}.
                      </span>{" "}
                      <span style={{ color: "var(--text-primary)" }}>
                        {pair[0]}
                      </span>
                      {pair[1] && (
                        <>
                          {" "}
                          <span style={{ color: "var(--text-secondary)" }}>
                            {pair[1]}
                          </span>
                        </>
                      )}
                    </span>
                  ))}
                  {moves.length === 0 && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      Waiting for match...
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Wager panel */}
            <div className="order-3" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Settlement first · always above the fold so users see result immediately */}
              {recoveryWager && recoveryMatch && !activeWager && (
                <WagerRecoveryBanner
                  wager={recoveryWager}
                  matchStatus={recoveryMatch.status}
                  matchResult={recoveryMatch.result}
                  onRecovered={() => {
                    setRecoveryWager(null);
                    setRecoveryMatch(null);
                    clearPersistedWager();
                    clearArenaSession();
                  }}
                />
              )}

              {lastSettlement && (
                <SettlementCard
                  settlement={lastSettlement}
                  asset={SUI_CHAIN.asset}
                  explorerName={SUI_CHAIN.explorerName}
                  treasuryMode={!isEscrowEnabled()}
                  onDismiss={clearSettlement}
                  onClaimPayout={
                    lastSettlement.claimPending ? handleClaimPayout : undefined
                  }
                  claiming={claimingPayout}
                />
              )}

              <WagerPanel
                whiteAgent={whiteAgent}
                blackAgent={blackAgent}
                poolSize={pool}
                activeWagerSide={activeWager?.side ?? null}
                activeWagerAmount={activeWager?.amount ?? null}
                disabled={isPlaying}
                wagering={wagering}
                onPlaceWager={handlePlaceWager}
              />

              {/* How odds work · explainer */}
              <details
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "12px 16px",
                }}
              >
                <summary
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    listStyle: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  HOW ODDS WORK
                  <span style={{ color: "var(--text-muted)", fontSize: 14 }}>?</span>
                </summary>
                <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                  <p style={{ marginBottom: 8 }}>
                    <strong style={{ color: "var(--accent)" }}>ELO</strong> is the standard chess rating system. Higher = stronger.
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    Odds come from the ELO difference. Bigger underdog = bigger payout.
                  </p>
                  <code style={{
                    display: "block", padding: "8px 10px", marginTop: 8,
                    background: "var(--bg-tertiary)", borderRadius: 4,
                    fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)",
                  }}>
                    payout = wager × odds × 0.97
                  </code>
                </div>
              </details>

              {/* Match info */}
              <div
                style={{
                  padding: 20,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  marginTop: 12,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    display: "block",
                    marginBottom: 16,
                    color: "var(--text-muted)",
                  }}
                >
                  MATCH INFO
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Format", value: "Blitz" },
                    {
                      label: "ELO Diff",
                      value: String(Math.abs(whiteAgent.elo - blackAgent.elo)),
                      gold: true,
                    },
                    { label: "White Odds", value: `${odds.white}x`, gold: true },
                    { label: "Black Odds", value: `${odds.black}x`, gold: true },
                    { label: "Moves", value: String(moves.length) },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {row.label}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          fontWeight: 600,
                          color: row.gold
                            ? "var(--accent)"
                            : "var(--text-primary)",
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                  {resultWinner && (
                    <>
                      <div style={{ height: 1, background: "var(--border)" }} />
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            color: "var(--text-secondary)",
                          }}
                        >
                          Result
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "var(--accent)",
                          }}
                        >
                          {resultWinner === "draw" ? "Draw" : resultWinner === "white" ? whiteAgent.name : blackAgent.name}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Agent select modal */}
      {selectingFor && (
        <AgentSelectModal
          side={selectingFor}
          excludeId={
            selectingFor === "white" ? blackAgent.id : whiteAgent.id
          }
          onSelect={selectAgent}
          onClose={() => setSelectingFor(null)}
        />
      )}
    </>
  );
}

function ArenaFallback() {
  return (
    <>
      <Header />
      <main
        style={{
          background: "var(--bg-primary)",
          paddingTop: 56,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="loading-bar" style={{ width: 192 }} />
      </main>
    </>
  );
}

export default function ArenaPage() {
  return (
    <Suspense fallback={<ArenaFallback />}>
      <ArenaContent />
    </Suspense>
  );
}
