"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectModal, useCurrentAccount } from "@mysten/dapp-kit";

const NAV_ITEMS = [
  {
    href: "/arena",
    label: "Arena",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="12" y1="3" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    href: "/spectate",
    label: "Live",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
      </svg>
    ),
  },
  {
    href: "/leaderboard",
    label: "Ranks",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
      </svg>
    ),
  },
] as const;

export default function MobileNav() {
  const pathname = usePathname();
  const account = useCurrentAccount();
  const [connectOpen, setConnectOpen] = useState(false);

  return (
    <nav
      className="md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderTop: "1px solid var(--border)",
        background: "rgba(3, 10, 26, 0.95)",
        backdropFilter: "blur(12px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="Mobile navigation"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", height: 64 }}>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                transition: "all 0.2s",
                color: active
                  ? "var(--accent)"
                  : "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              {icon}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.05em",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
        {account ? (
          <Link
            href="/wallet"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              color: pathname === "/wallet" ? "var(--accent)" : "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M2 10h20" />
            </svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.05em" }}>Wallet</span>
          </Link>
        ) : (
          <ConnectModal
            trigger={
              <button
                type="button"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                  color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M2 10h20" />
                </svg>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.05em" }}>Connect</span>
              </button>
            }
            open={connectOpen}
            onOpenChange={setConnectOpen}
          />
        )}
      </div>
    </nav>
  );
}
