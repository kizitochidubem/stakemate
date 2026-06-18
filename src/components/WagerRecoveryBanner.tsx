"use client";

import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { isEscrowEnabled, sendClaimPayout, type SignAndExecute } from "@/lib/escrow-sui/client";
import { friendlyEscrowError } from "@/lib/escrow-sui/error-messages";
import { claimEscrowPayout, settleEscrowMatch } from "@/lib/escrow-sui/settle";
import { fetchJson } from "@/lib/fetch-json";
import type { PersistedWager } from "@/lib/wager-persist";
import { clearPersistedWager } from "@/lib/wager-persist";
import Spinner from "./Spinner";

interface WagerRecoveryBannerProps {
  wager: PersistedWager;
  matchStatus: "live" | "finished" | "missing";
  matchResult: "white" | "black" | "draw" | null;
  onRecovered: () => void;
}

interface EscrowMatchStateResponse {
  match: {
    status: "missing" | "open" | "settled" | "cancelled";
    winner?: string;
  };
  wager: {
    exists: boolean;
    claimed: boolean;
    amountMist: number;
    side: "white" | "black";
  } | null;
  canSettle: boolean;
  canClaim: boolean;
  alreadyClaimed: boolean;
}

export default function WagerRecoveryBanner({
  wager,
  matchStatus,
  matchResult,
  onRecovered,
}: WagerRecoveryBannerProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chain, setChain] = useState<EscrowMatchStateResponse | null>(null);
  const [chainLoading, setChainLoading] = useState(false);

  const signAndExecute: SignAndExecute = useCallback(
    async (tx) => {
      const result = await signAndExecuteTransaction({ transaction: tx });
      return { digest: result.digest };
    },
    [signAndExecuteTransaction]
  );

  useEffect(() => {
    if (!account || !isEscrowEnabled()) return;
    let cancelled = false;
    setChainLoading(true);
    void fetchJson<EscrowMatchStateResponse>(
      `/api/sui-escrow/match-state?matchId=${encodeURIComponent(wager.matchId)}&wallet=${encodeURIComponent(account.address)}`,
      { cache: "no-store", timeoutMs: 15_000 }
    )
      .then((data) => {
        if (!cancelled) setChain(data);
      })
      .catch(() => {
        if (!cancelled) setChain(null);
      })
      .finally(() => {
        if (!cancelled) setChainLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, wager.matchId]);

  const claimOnly = useCallback(async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      await claimEscrowPayout(client, account.address, wager.matchId, signAndExecute);
      clearPersistedWager();
      onRecovered();
    } catch (err) {
      setError(friendlyEscrowError(err));
    } finally {
      setBusy(false);
    }
  }, [account, client, onRecovered, signAndExecute, wager.matchId]);

  const claimFinished = useCallback(async () => {
    if (!account || !matchResult) return;
    setBusy(true);
    setError(null);
    try {
      if (isEscrowEnabled()) {
        if (chain?.match.status === "open") {
          await settleEscrowMatch(wager.matchId, matchResult);
        }
        const backedWin =
          (matchResult === "white" && wager.side === "white") ||
          (matchResult === "black" && wager.side === "black");
        if (matchResult === "draw" || backedWin) {
          await claimEscrowPayout(client, account.address, wager.matchId, signAndExecute);
        }
      }
      clearPersistedWager();
      onRecovered();
    } catch (err) {
      setError(friendlyEscrowError(err));
    } finally {
      setBusy(false);
    }
  }, [
    account,
    chain?.match.status,
    client,
    matchResult,
    onRecovered,
    signAndExecute,
    wager.matchId,
    wager.side,
  ]);

  const recoverStuck = useCallback(async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      if (
        chain?.canClaim ||
        chain?.match.status === "settled" ||
        chain?.match.status === "cancelled"
      ) {
        await claimOnly();
        return;
      }

      const res = await fetch("/api/sui-escrow/recover-wager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: wager.matchId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadySettled?: boolean;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Could not settle match");
      }

      await sendClaimPayout(client, account.address, wager.matchId, signAndExecute);
      clearPersistedWager();
      onRecovered();
    } catch (err) {
      setError(friendlyEscrowError(err));
    } finally {
      setBusy(false);
    }
  }, [
    account,
    chain?.canClaim,
    chain?.match.status,
    claimOnly,
    client,
    onRecovered,
    signAndExecute,
    wager.matchId,
  ]);

  if (chain?.alreadyClaimed) {
    return (
      <RecoveryShell
        title="Stake already claimed"
        detail={`Your ${wager.amount} SUI wager for this match was returned on-chain.`}
      >
        <button
          type="button"
          onClick={() => {
            clearPersistedWager();
            onRecovered();
          }}
          style={secondaryBtn}
        >
          Dismiss
        </button>
      </RecoveryShell>
    );
  }

  const title =
    matchStatus === "missing"
      ? "Match interrupted"
      : matchStatus === "finished"
        ? "Collect your payout"
        : "Wager in progress";

  const detail =
    chain?.match.status === "cancelled"
      ? `${wager.amount} SUI is ready to refund (match was cancelled on-chain).`
      : chain?.match.status === "settled"
        ? `${wager.amount} SUI is ready to claim from escrow (match settled as ${chain.match.winner ?? "draw"}).`
        : matchStatus === "missing"
          ? `${wager.amount} SUI on ${wager.agentName} · we'll settle as a draw, then you approve one claim in your wallet.`
          : `${wager.amount} SUI on ${wager.agentName}`;

  const claimable =
    chain?.canClaim ||
    chain?.match.status === "settled" ||
    chain?.match.status === "cancelled";

  const primaryLabel = claimable
    ? "Claim refund"
    : matchStatus === "finished" && matchResult
      ? "Claim payout"
      : "Refund stake";

  const primaryAction = claimable
    ? claimOnly
    : matchStatus === "finished" && matchResult
      ? claimFinished
      : recoverStuck;

  const showPrimary =
    isEscrowEnabled() &&
    (matchStatus === "missing" ||
      matchStatus === "finished" ||
      chain?.canClaim);

  return (
    <RecoveryShell title={title} detail={detail}>
      {chainLoading && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          Checking on-chain status…
        </p>
      )}
      {showPrimary && (
        <button
          type="button"
          disabled={busy || !account}
          onClick={() => void primaryAction()}
          style={primaryBtn}
        >
          {busy && <Spinner size={12} color="var(--bg-primary)" />}
          {primaryLabel}
        </button>
      )}
      {error && (
        <div style={errorBox}>
          <p style={{ fontSize: 12, color: "var(--danger)", margin: 0, lineHeight: 1.5 }}>
            {error}
          </p>
        </div>
      )}
    </RecoveryShell>
  );
}

function RecoveryShell({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        padding: 16,
        marginBottom: 16,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 6,
        }}
      >
        {title}
      </p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
        {detail}
      </p>
      {children}
    </div>
  );
}

const primaryBtn: CSSProperties = {
  padding: "10px 18px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 600,
  background: "var(--accent)",
  color: "var(--bg-primary)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const secondaryBtn: CSSProperties = {
  ...primaryBtn,
  background: "var(--bg-tertiary)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
};

const errorBox: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 8,
  background: "rgba(239, 68, 68, 0.08)",
  border: "1px solid rgba(239, 68, 68, 0.25)",
  maxHeight: 120,
  overflow: "auto",
};
