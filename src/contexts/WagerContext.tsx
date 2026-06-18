"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearPersistedWager } from "@/lib/wager-persist";

export interface ActiveWager {
  matchId: string;
  side: "white" | "black";
  amount: number;
  agentName: string;
  odds: number;
  placedAt: number;
  signature?: string;
  explorerUrl?: string;
}

export type SettlementOutcome = "won" | "lost" | "refund";

export interface WagerSettlement {
  outcome: SettlementOutcome;
  /** SUI amount to be paid out. 0 for losses, stake for refunds, stake*odds for wins. */
  payout: number;
  /** Original wager amount, for context. */
  stake: number;
  agentName: string;
  signature?: string;
  explorerUrl?: string;
  /** Escrow: user still needs to sign claim_payout (win or draw). */
  claimPending?: boolean;
  claimMatchId?: string;
}

interface WagerContextValue {
  activeWager: ActiveWager | null;
  lastSettlement: WagerSettlement | null;
  placeWager: (wager: Omit<ActiveWager, "placedAt">) => void;
  clearActiveWager: () => void;
  settleMatch: (
    winner: "white" | "black" | "draw",
    whiteName: string,
    blackName: string
  ) => void;
  clearSettlement: () => void;
  /** Update settlement after on-chain claim (escrow mode). */
  patchLastSettlement: (patch: Partial<WagerSettlement>) => void;
}

const WagerContext = createContext<WagerContextValue | null>(null);

// Fee is collected server-side when payouts ship. UI shows gross.
const PLATFORM_FEE = 0;

export function WagerProvider({ children }: { children: ReactNode }) {
  const [activeWager, setActiveWager] = useState<ActiveWager | null>(null);
  const [lastSettlement, setLastSettlement] = useState<WagerSettlement | null>(null);

  const placeWager = useCallback((wager: Omit<ActiveWager, "placedAt">) => {
    setLastSettlement(null);
    setActiveWager({ ...wager, placedAt: Date.now() });
  }, []);

  const clearActiveWager = useCallback(() => setActiveWager(null), []);
  const clearSettlement = useCallback(() => setLastSettlement(null), []);

  const patchLastSettlement = useCallback((patch: Partial<WagerSettlement>) => {
    setLastSettlement((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const settleMatch = useCallback(
    (winner: "white" | "black" | "draw", _whiteName: string, _blackName: string) => {
      if (!activeWager) return;

      const backedWhite = activeWager.side === "white";

      let outcome: SettlementOutcome;
      let payout: number;

      if (winner === "draw") {
        // Draw = stake refunded. Standard sportsbook behavior ("push").
        outcome = "refund";
        payout = activeWager.amount;
      } else if (
        (winner === "white" && backedWhite) ||
        (winner === "black" && !backedWhite)
      ) {
        outcome = "won";
        payout = activeWager.amount * activeWager.odds * (1 - PLATFORM_FEE);
      } else {
        outcome = "lost";
        payout = 0;
      }

      setLastSettlement({
        outcome,
        payout: Math.round(payout * 1000) / 1000,
        stake: activeWager.amount,
        agentName: activeWager.agentName,
        signature: activeWager.signature,
        explorerUrl: activeWager.explorerUrl,
      });
      setActiveWager(null);
      clearPersistedWager();
    },
    [activeWager]
  );

  const value = useMemo(
    () => ({
      activeWager,
      lastSettlement,
      placeWager,
      clearActiveWager,
      settleMatch,
      clearSettlement,
      patchLastSettlement,
    }),
    [
      activeWager,
      lastSettlement,
      placeWager,
      clearActiveWager,
      settleMatch,
      clearSettlement,
      patchLastSettlement,
    ]
  );

  return <WagerContext.Provider value={value}>{children}</WagerContext.Provider>;
}

export function useWager(): WagerContextValue {
  const ctx = useContext(WagerContext);
  if (!ctx) throw new Error("useWager must be used within WagerProvider");
  return ctx;
}
