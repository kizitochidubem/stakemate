"use client";

import Link from "next/link";
import logo from "@/app/icon.jpg"
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import ConnectWalletButton from "@/components/ConnectWalletButton";

const PRIMARY_NAV = [
  { href: "/arena", label: "Arena" },
  { href: "/play", label: "Play" },
];

const MORE_NAV = [
  { href: "/tournament", label: "Tournament" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/spectate", label: "Spectate" },
];

const ALL_HREFS = [...PRIMARY_NAV, ...MORE_NAV].map((n) => n.href);

function isActive(path: string, href: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const path = usePathname();

  const moreActive = MORE_NAV.some((item) => isActive(path, item.href));

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [moreOpen]);

  const linkStyle = (href: string): CSSProperties => ({
    fontSize: 13,
    fontWeight: 500,
    padding: "6px 10px",
    borderRadius: 4,
    textDecoration: "none",
    color: isActive(path, href) ? "var(--text-primary)" : "var(--text-muted)",
    background: isActive(path, href) ? "var(--bg-tertiary)" : "transparent",
    whiteSpace: "nowrap",
  });

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "rgba(3, 10, 26, 0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 20px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <Image
            src={logo}
            alt="Stakemate"
            width={28}
            height={28}
            style={{ borderRadius: 4, objectFit: "cover" }}
          />
          <span
            className="hidden sm:inline"
            style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}
          >
            STAKEMATE
          </span>
        </Link>

        <nav className="hidden md:flex items-center" style={{ gap: 2, minWidth: 0 }}>
          {PRIMARY_NAV.map(({ href, label }) => (
            <Link key={href} href={href} style={linkStyle(href)}>
              {label}
            </Link>
          ))}

          <div ref={moreRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              style={{
                fontSize: 13,
                fontWeight: 500,
                padding: "6px 10px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                color: moreActive ? "var(--text-primary)" : "var(--text-muted)",
                background:
                  moreActive || moreOpen ? "var(--bg-tertiary)" : "transparent",
              }}
            >
              More
            </button>
            {moreOpen && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  minWidth: 160,
                  padding: 6,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                  zIndex: 60,
                }}
              >
                {MORE_NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    style={{
                      display: "block",
                      padding: "8px 10px",
                      fontSize: 13,
                      textDecoration: "none",
                      borderRadius: 4,
                      color: isActive(path, href)
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div
          className="hidden md:flex items-center"
          style={{ gap: 8, flexShrink: 0 }}
        >
          <ConnectWalletButton />
        </div>

        <div className="flex md:hidden items-center gap-2 shrink-0">
          <ConnectWalletButton />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            style={{
              padding: 8,
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              {open ? (
                <path
                  d="M4 4L16 16M16 4L4 16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              ) : (
                <path
                  d="M3 5H17M3 10H17M3 15H17"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div
          className="md:hidden"
          style={{
            background: "var(--bg-primary)",
            borderTop: "1px solid var(--border)",
            padding: 16,
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          }}
        >
          {ALL_HREFS.map((href) => {
            const item = [...PRIMARY_NAV, ...MORE_NAV].find((n) => n.href === href);
            if (!item) return null;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "10px 8px",
                  fontSize: 14,
                  textDecoration: "none",
                  color: isActive(path, href) ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
