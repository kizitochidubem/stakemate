"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Link from "next/link";
import { ConnectModal, useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { MIST_PER_SUI, truncateAddress } from "@/lib/sui/network";

export default function ConnectWalletButton({
  fullWidth = false,
}: {
  fullWidth?: boolean;
}) {
  const account = useCurrentAccount();
  const [open, setOpen] = useState(false);

  const { data: balance } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: account !== null, refetchInterval: 30_000 }
  );

  if (account) {
    const sui = balance ? Number(balance.totalBalance) / Number(MIST_PER_SUI) : null;

    return (
      <Link href="/wallet" style={connectedLinkStyle(fullWidth)} title="Open wallet">
        <span style={dotStyle} />
        <span style={{ color: "var(--accent)", whiteSpace: "nowrap" }}>
          {sui !== null ? `${sui.toFixed(2)} SUI` : "—"}
        </span>
        <span style={{ color: "var(--text-muted)" }}>|</span>
        <span style={{ whiteSpace: "nowrap" }}>{truncateAddress(account.address, 4)}</span>
      </Link>
    );
  }

  return (
    <ConnectModal
      trigger={
        <button type="button" style={connectBtnStyle(fullWidth)}>
          Connect Sui Wallet
        </button>
      }
      open={open}
      onOpenChange={setOpen}
    />
  );
}

function connectedLinkStyle(fullWidth?: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 8,
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    textDecoration: "none",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    fontWeight: 600,
    width: fullWidth ? "100%" : undefined,
    justifyContent: fullWidth ? "center" : "flex-start",
    maxWidth: fullWidth ? "100%" : 200,
    cursor: "pointer",
  };
}

function connectBtnStyle(fullWidth?: boolean): CSSProperties {
  return {
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    background: "var(--accent)",
    color: "var(--bg-primary)",
    border: "none",
    cursor: "pointer",
    width: fullWidth ? "100%" : undefined,
    whiteSpace: "nowrap",
  };
}

const dotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "var(--success)",
  flexShrink: 0,
};
