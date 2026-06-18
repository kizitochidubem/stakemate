"use client";

import type { WagerSettlement } from "@/contexts/WagerContext";

interface SettlementCardProps {
  settlement: WagerSettlement;
  asset?: string;
  explorerName?: string;
  /** Treasury MVP — no on-chain claim yet */
  treasuryMode?: boolean;
  onDismiss: () => void;
  onClaimPayout?: () => void;
  claiming?: boolean;
}

const OUTCOMES: Record<
  WagerSettlement["outcome"],
  { label: string; color: string; bg: string; border: string }
> = {
  won: {
    label: "WAGER WON",
    color: "var(--accent)",
    bg: "rgba(77, 162, 255, 0.08)",
    border: "var(--accent)",
  },
  refund: {
    label: "STAKE REFUNDED",
    color: "var(--text-primary)",
    bg: "rgba(161, 161, 170, 0.08)",
    border: "var(--text-secondary)",
  },
  lost: {
    label: "WAGER LOST",
    color: "var(--danger)",
    bg: "rgba(239, 68, 68, 0.08)",
    border: "var(--danger)",
  },
};

export default function SettlementCard({
  settlement,
  asset = "SUI",
  explorerName = "Sui Vision",
  treasuryMode = false,
  onDismiss,
  onClaimPayout,
  claiming = false,
}: SettlementCardProps) {
  const o = OUTCOMES[settlement.outcome];

  return (
    <div
      className="animate-slide-up"
      style={{
        padding: 16,
        background: o.bg,
        border: `1px solid ${o.border}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.2em",
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        {o.label}
      </div>

      {settlement.outcome === "won" && (
        <>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: o.color }}>
            +{settlement.payout.toFixed(3)} {asset}
          </p>
          <p style={{ fontSize: 11, marginTop: 6, color: "var(--text-secondary)" }}>
            {treasuryMode
              ? `${settlement.agentName} won. Payouts ship from treasury until on-chain escrow is live.`
              : settlement.claimPending
                ? `${settlement.agentName} won. Claim your payout from escrow (one wallet approval).`
                : `${settlement.agentName} won. Payout sent.`}
          </p>
        </>
      )}

      {settlement.outcome === "refund" && (
        <>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, color: o.color }}>
            {settlement.payout.toFixed(3)} {asset} back
          </p>
          <p style={{ fontSize: 11, marginTop: 6, color: "var(--text-secondary)" }}>
            {treasuryMode
              ? `Draw · treasury refunds are processed manually until escrow ships.`
              : settlement.claimPending
                ? `Draw · claim your ${settlement.stake.toFixed(3)} ${asset} stake back (one wallet approval).`
                : `Draw · your ${settlement.stake.toFixed(3)} ${asset} stake was returned.`}
          </p>
        </>
      )}

      {settlement.outcome === "lost" && (
        <>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, color: o.color }}>
            −{settlement.stake.toFixed(3)} {asset}
          </p>
          <p style={{ fontSize: 11, marginTop: 6, color: "var(--text-secondary)" }}>
            {settlement.agentName} lost. Your stake stays in the match pool for the winner.
          </p>
        </>
      )}

      {settlement.explorerUrl && (
        <a
          href={settlement.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: o.color,
            textDecoration: "none",
            borderBottom: `1px solid ${o.border}`,
          }}
        >
          {settlement.outcome === "refund" || settlement.outcome === "won"
            ? `view payout on ${explorerName} ↗`
            : `view wager on ${explorerName} ↗`}
        </a>
      )}

      {settlement.claimPending && onClaimPayout && (
        <button
          type="button"
          disabled={claiming}
          onClick={onClaimPayout}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "10px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            background: "var(--accent)",
            color: "var(--bg-primary)",
            border: "none",
            borderRadius: 6,
            cursor: claiming ? "wait" : "pointer",
            opacity: claiming ? 0.7 : 1,
          }}
        >
          {claiming ? "CONFIRM IN WALLET…" : "CLAIM PAYOUT"}
        </button>
      )}

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.15em",
            color: "var(--text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}
