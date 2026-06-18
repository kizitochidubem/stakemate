"use client";

import { useState } from "react";
import { Agent } from "@/lib/agents";
import { calculateOdds } from "@/lib/match";
import { isEscrowEnabled } from "@/lib/escrow-sui/client";
import { SUI_CHAIN } from "@/lib/chains";
import Spinner from "./Spinner";

interface WagerPanelProps {
  whiteAgent: Agent;
  blackAgent: Agent;
  poolSize: number;
  activeWagerSide?: "white" | "black" | null;
  activeWagerAmount?: number | null;
  disabled?: boolean;
  wagering?: boolean;
  onPlaceWager?: (side: "white" | "black", amount: number) => void;
}

const PRESETS = [0.1, 0.5, 1, 5];

export default function WagerPanel({
  whiteAgent,
  blackAgent,
  poolSize,
  activeWagerSide = null,
  activeWagerAmount = null,
  disabled = false,
  wagering = false,
  onPlaceWager,
}: WagerPanelProps) {
  const [selectedSide, setSelectedSide] = useState<"white" | "black" | null>(
    null
  );
  const [amount, setAmount] = useState<number>(0.5);
  const odds = calculateOdds(whiteAgent, blackAgent);
  const asset = SUI_CHAIN.asset;
  const poolLabel = poolSize > 0 ? `${poolSize.toFixed(2)} ${asset}` : "—";

  const payout = selectedSide
    ? Math.round(
        amount *
          (selectedSide === "white" ? odds.white : odds.black) *
          0.97 *
          100
      ) / 100
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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Wager Book
        </h3>
        <div style={{ textAlign: "right" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.15em",
              display: "block",
              color: "var(--text-muted)",
            }}
          >
            POOL
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 700,
              color: poolSize > 0 ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {poolLabel}
          </span>
        </div>
      </div>

      {/* Token selector */}
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.15em",
            display: "block",
            marginBottom: 8,
            color: "var(--text-muted)",
          }}
        >
          WAGER WITH
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            style={{
              flex: 1,
              padding: "8px 12px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--accent)",
              color: "var(--bg-primary)",
              border: "none",
              borderRadius: 6,
              cursor: "default",
            }}
          >
            {asset}
          </button>
        </div>
      </div>

      {/* Odds display */}
      <div style={{ marginBottom: 20 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.15em",
            display: "block",
            marginBottom: 8,
            color: "var(--text-muted)",
          }}
        >
          ODDS
        </span>
        <div style={{ display: "flex", gap: 1, background: "var(--bg-primary)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ flex: 1, textAlign: "center", padding: "10px 0", background: "var(--bg-tertiary)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, display: "block", marginBottom: 2, color: "var(--text-secondary)" }}>
              {whiteAgent.name}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
              {odds.white}x
            </span>
          </div>
          <div style={{ flex: 1, textAlign: "center", padding: "10px 0", background: "var(--bg-tertiary)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, display: "block", marginBottom: 2, color: "var(--text-secondary)" }}>
              {blackAgent.name}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
              {odds.black}x
            </span>
          </div>
        </div>
      </div>

      {/* Side selection */}
      <div style={{ marginBottom: 20 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.15em",
            display: "block",
            marginBottom: 8,
            color: "var(--text-muted)",
          }}
        >
          BACK A SIDE
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["white", "black"] as const).map((side) => {
            const agent = side === "white" ? whiteAgent : blackAgent;
            const isSelected = selectedSide === side;
            return (
              <button
                key={side}
                type="button"
                style={{
                  flex: 1,
                  padding: "12px 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "all 0.2s",
                  background: isSelected
                    ? "rgba(77, 162, 255, 0.1)"
                    : "var(--bg-tertiary)",
                  border: `1px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                  borderRadius: 6,
                  color: isSelected
                    ? "var(--accent)"
                    : "var(--text-secondary)",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedSide(side)}
              >
                {agent.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount */}
      <div style={{ marginBottom: 20 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.15em",
            display: "block",
            marginBottom: 8,
            color: "var(--text-muted)",
          }}
        >
          AMOUNT ({asset})
        </span>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              style={{
                flex: 1,
                padding: "8px 0",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 500,
                transition: "all 0.2s",
                background:
                  amount === p ? "var(--accent)" : "var(--bg-tertiary)",
                color:
                  amount === p
                    ? "var(--bg-primary)"
                    : "var(--text-secondary)",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
              onClick={() => setAmount(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          style={{
            width: "100%",
            padding: "10px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            outline: "none",
            transition: "border-color 0.2s",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--text-muted)",
            borderRadius: 6,
            color: "var(--accent)",
          }}
          step={0.1}
          min={0.01}
        />
      </div>

      {/* Potential payout */}
      {selectedSide && amount > 0 && (
        <div
          className="animate-fade-in"
          style={{
            marginBottom: 20,
            padding: 16,
            background: "var(--bg-tertiary)",
            borderRadius: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "var(--text-secondary)",
              }}
            >
              POTENTIAL PAYOUT
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--accent)",
              }}
            >
              {payout.toFixed(2)} {asset}
            </span>
          </div>
          <div style={{ marginTop: 4, textAlign: "right" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--text-muted)",
              }}
            >
              estimated payout
            </span>
          </div>
        </div>
      )}

      {/* Active wager indicator */}
      {activeWagerSide && activeWagerAmount != null && (
        <div
          className="animate-border-glow"
          style={{
            marginBottom: 16,
            padding: 12,
            border: "1px solid var(--accent-dim)",
            borderRadius: 6,
            background: "rgba(77, 162, 255, 0.05)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.15em",
              color: "var(--accent)",
            }}
          >
            YOUR WAGER &middot; {activeWagerAmount} {asset} ON{" "}
            {activeWagerSide.toUpperCase()}
          </span>
        </div>
      )}

      {/* Place wager button */}
      <button
        type="button"
        style={{
          width: "100%",
          padding: "14px 0",
          fontFamily: "var(--font-display)",
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "0.02em",
          transition: "all 0.3s",
          background: selectedSide
            ? "var(--accent)"
            : "var(--bg-tertiary)",
          color: selectedSide
            ? "var(--bg-primary)"
            : "var(--text-muted)",
          boxShadow: selectedSide
            ? "0 0 20px rgba(77, 162, 255, 0.25)"
            : "none",
          border: "none",
          borderRadius: 8,
          cursor:
            !selectedSide || amount <= 0 || disabled || !!activeWagerSide || wagering
              ? "not-allowed"
              : "pointer",
          opacity:
            !selectedSide || amount <= 0 || disabled || !!activeWagerSide
              ? 0.3
              : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
        disabled={
          !selectedSide || amount <= 0 || disabled || !!activeWagerSide || wagering
        }
        onClick={() => selectedSide && onPlaceWager?.(selectedSide, amount)}
      >
        {wagering && <Spinner size={16} color="var(--bg-primary)" />}
        {wagering
          ? "Confirm in wallet..."
          : activeWagerSide
            ? "Wager Locked"
            : disabled
              ? "Match In Progress"
              : selectedSide
                ? "Place Wager"
                : "Select a Side"}
      </button>

      {/* Transparency notice */}
      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          background: "var(--bg-primary)",
          border: "1px dashed var(--border)",
          borderRadius: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          lineHeight: 1.6,
          color: "var(--text-muted)",
        }}
      >
        <strong style={{ color: "var(--text-secondary)" }}>Draws:</strong> stake
        refunded (no win/loss). Checkmate or move-cap adjudication picks a
        winner · most arena matches end decisively.
        <br />
        <strong style={{ color: "var(--text-secondary)" }}>Escrow:</strong>{" "}
        {isEscrowEnabled()
          ? `${asset} locks in the match escrow. Solo wins pay from the escrow liquidity pool when no counter-stakes exist.`
          : `Treasury mode · wagers send ${asset} to the treasury wallet.`}
        <br />
        <strong style={{ color: "var(--text-secondary)" }}>Refresh:</strong>{" "}
        reconnect the same wallet · we restore your wager and offer recovery if
        the tab closed mid-match.
      </div>
    </div>
  );
}
