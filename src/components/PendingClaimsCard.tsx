"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import Spinner from "./Spinner";
import { sendClaimPayout, isEscrowEnabled, type SignAndExecute } from "@/lib/escrow-sui/client";
import { friendlyEscrowError } from "@/lib/escrow-sui/error-messages";
import { fetchJson } from "@/lib/fetch-json";
import type {
  ClaimState,
  PendingClaimRow,
} from "@/app/api/sui-escrow/pending-claims/route";

interface PendingClaimsResponse {
  rows: PendingClaimRow[];
  escrowEnabled: boolean;
}

interface PendingClaimsCardProps {
  wallet: string;
}

const CLAIMABLE_STATES: ClaimState[] = [
  "claimable_won",
  "claimable_draw",
  "claimable_cancelled",
  "claimable_recover",
];

/**
 * On-chain claim center for the connected wallet. Shows every wager
 * the user has placed in our escrow program, bucketed by whether
 * there's something to do (claim, recover) or just history (claimed,
 * lost, pending live match).
 *
 * One signature per claim. The button label tells the user exactly
 * what's about to happen.
 */
export default function PendingClaimsCard({ wallet }: PendingClaimsCardProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [rows, setRows] = useState<PendingClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [escrowEnabled, setEscrowEnabled] = useState<boolean>(isEscrowEnabled());

  // Per-row action state so two claims can't run at once.
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const signAndExecute: SignAndExecute = useCallback(
    async (tx) => {
      const result = await signAndExecuteTransaction({ transaction: tx });
      return { digest: result.digest };
    },
    [signAndExecuteTransaction]
  );

  const reload = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<PendingClaimsResponse>(
        `/api/sui-escrow/pending-claims?wallet=${encodeURIComponent(wallet)}`,
        { timeoutMs: 8000 }
      );
      setRows(data.rows);
      setEscrowEnabled(data.escrowEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load claims");
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleClaim = useCallback(
    async (row: PendingClaimRow) => {
      if (!account) {
        setRowError((m) => ({
          ...m,
          [row.matchId]: "Wallet not ready",
        }));
        return;
      }
      setBusyMatchId(row.matchId);
      setRowError((m) => {
        const { [row.matchId]: _drop, ...rest } = m;
        return rest;
      });

      try {
        // For claimable_recover the match is still Open on-chain; we
        // first ask the server to settle it as a draw (oracle signature),
        // then immediately claim the refund (user signature).
        if (row.state === "claimable_recover") {
          await fetchJson("/api/sui-escrow/recover-wager", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId: row.matchId }),
            timeoutMs: 12000,
          });
        }

        await sendClaimPayout(client, account.address, row.matchId, signAndExecute);

        // Optimistic update + reload to confirm.
        setRows((prev) =>
          prev.map((r) =>
            r.matchId === row.matchId ? { ...r, state: "claimed" } : r
          )
        );
        // Best-effort refresh in the background.
        void reload();
      } catch (err) {
        setRowError((m) => ({
          ...m,
          [row.matchId]: friendlyEscrowError(err),
        }));
      } finally {
        setBusyMatchId(null);
      }
    },
    [account, client, signAndExecute, reload]
  );

  const claimable = rows.filter((r) => CLAIMABLE_STATES.includes(r.state));
  const history = rows.filter((r) => !CLAIMABLE_STATES.includes(r.state));

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Pending Claims
          {claimable.length > 0 && (
            <span
              style={{
                marginLeft: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--accent)",
                color: "var(--bg-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {claimable.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "4px 10px",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {/* Empty / loading / error states */}
      {!escrowEnabled && !loading && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          On-chain escrow is not configured on this deployment. Wagers route
          to the treasury wallet directly.
        </p>
      )}

      {loading && rows.length === 0 && (
        <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
          Loading...
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 12 }}>
          {error}
        </p>
      )}

      {!loading && rows.length === 0 && !error && (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          No wagers yet. Place one in the arena and the claim will show up here.
        </p>
      )}

      {/* Claimable */}
      {claimable.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {claimable.map((row) => (
            <ClaimRow
              key={row.matchId}
              row={row}
              busy={busyMatchId === row.matchId}
              onClaim={() => void handleClaim(row)}
              error={rowError[row.matchId]}
            />
          ))}
        </div>
      )}

      {/* History (collapsed by default visually · kept short) */}
      {history.length > 0 && (
        <div style={{ marginTop: claimable.length > 0 ? 16 : 0 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.15em",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            History
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.slice(0, 5).map((row) => (
              <HistoryRow key={row.matchId} row={row} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function ClaimRow({
  row,
  busy,
  onClaim,
  error,
}: {
  row: PendingClaimRow;
  busy: boolean;
  onClaim: () => void;
  error?: string;
}) {
  const label = describeClaim(row);
  const buttonText = busy
    ? row.state === "claimable_recover"
      ? "Recovering..."
      : "Claiming..."
    : row.state === "claimable_won"
      ? "Claim winnings"
      : row.state === "claimable_recover"
        ? "Recover + Claim"
        : "Claim refund";

  return (
    <div
      style={{
        padding: 12,
        background: "var(--bg-primary)",
        border: "1px solid var(--accent-dim)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        className="pending-claim-row"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.agentName}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 2,
              // Description can wrap on narrow screens instead of getting cut off.
              whiteSpace: "normal",
              lineHeight: 1.5,
            }}
          >
            {label}
          </div>
        </div>
        <button
          type="button"
          onClick={onClaim}
          disabled={busy}
          className="pending-claim-button"
          style={{
            padding: "10px 14px",
            background: "var(--accent)",
            color: "var(--bg-primary)",
            border: "none",
            borderRadius: 6,
            fontFamily: "var(--font-display)",
            fontSize: 12,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            whiteSpace: "nowrap",
            opacity: busy ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {busy && <Spinner size={12} color="var(--bg-primary)" />}
          {buttonText}
        </button>
      </div>

      {error && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--danger)",
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ row }: { row: PendingClaimRow }) {
  const label = describeHistory(row);
  const color =
    row.state === "claimed"
      ? "var(--accent)"
      : row.state === "lost"
        ? "var(--danger)"
        : "var(--text-muted)";

  return (
    <div
      style={{
        padding: "8px 12px",
        background: "transparent",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-secondary)",
            display: "inline-block",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "bottom",
          }}
        >
          {row.amount} SUI on {row.agentName}
        </span>
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ============================================================
// Copy
// ============================================================

function describeClaim(row: PendingClaimRow): string {
  switch (row.state) {
    case "claimable_won":
      return `${row.amount} SUI stake + winnings (you backed ${row.side} and ${row.winner ?? row.side} won)`;
    case "claimable_draw":
      return `${row.amount} SUI stake refund (match drew)`;
    case "claimable_cancelled":
      return `${row.amount} SUI stake refund (match was cancelled on-chain)`;
    case "claimable_recover":
      return `${row.amount} SUI on ${row.side} · match still open on-chain; we'll settle as draw, then refund`;
    default:
      return "";
  }
}

function describeHistory(row: PendingClaimRow): string {
  switch (row.state) {
    case "claimed":
      return "Claimed";
    case "lost":
      return `Lost (${row.winner ?? "?"} won)`;
    case "pending":
      return "Match live";
    case "unknown":
      return "Pre-escrow / unknown";
    default:
      return row.state;
  }
}
