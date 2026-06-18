"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Agent, getWinRate } from "@/lib/agents";
import { PERSONALITY_THEME } from "@/lib/agent-theme";
import AgentPortrait from "./AgentPortrait";

interface AgentInspectModalProps {
  agent: Agent;
  onClose: () => void;
}

type Tab = "overview" | "form" | "lore";

/**
 * Fullscreen agent inspector. The portrait card in the center is
 * drag-rotatable (mouse / touch). Side panel has tabs for overview,
 * recent form, and lore. Action buttons let you challenge the agent
 * (`/play`) or watch it in the arena.
 *
 * Trading-card / collectible vibe. Pure CSS 3D - no WebGL.
 */
export default function AgentInspectModal({ agent, onClose }: AgentInspectModalProps) {
  const theme = PERSONALITY_THEME[agent.personality];
  const [tab, setTab] = useState<Tab>("overview");

  // ============ 3D rotation state ============
  // rotY = around vertical axis (yaw), rotX = around horizontal (pitch)
  const [rotY, setRotY] = useState(-12);
  const [rotX, setRotX] = useState(6);
  const [autoSpin, setAutoSpin] = useState(true);
  const dragging = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Auto-spin until user grabs it
  useEffect(() => {
    if (!autoSpin) return;
    const id = setInterval(() => {
      setRotY((y) => y - 0.4);
    }, 30);
    return () => clearInterval(id);
  }, [autoSpin]);

  // ESC to close + lock body scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setAutoSpin(false);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !lastPos.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setRotY((y) => y + dx * 0.4);
    setRotX((x) => Math.max(-30, Math.min(30, x - dy * 0.3)));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => {
    dragging.current = false;
    lastPos.current = null;
  };

  const overlayRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: `radial-gradient(circle at 50% 50%, ${theme.glow} 0%, rgba(9, 9, 11, 0.95) 60%)`,
        backdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        className="inspect-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 380px",
          gap: 32,
          width: "100%",
          maxWidth: 1100,
          maxHeight: "92vh",
          alignItems: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============ 3D rotatable card ============ */}
        <div
          style={{
            perspective: 1400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 460,
          }}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              width: 320,
              height: 460,
              transformStyle: "preserve-3d",
              transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)`,
              transition: dragging.current ? "none" : "transform 0.15s ease-out",
              cursor: dragging.current ? "grabbing" : "grab",
              touchAction: "none",
              willChange: "transform",
            }}
          >
            {/* ====== Card front ====== */}
            <CardFace agent={agent} face="front" />

            {/* ====== Card back ====== */}
            <CardFace agent={agent} face="back" />

            {/* ====== Edge bevel ====== */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 22,
                background: `linear-gradient(135deg, ${theme.accent}33, transparent)`,
                transform: "translateZ(-1px)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* ============ Side panel ============ */}
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 24,
            maxHeight: "92vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.25em",
                  color: theme.accent,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                AGENT FILE
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 28,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.025em",
                  marginBottom: 4,
                }}
              >
                {agent.name}
              </h2>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                }}
              >
                {agent.style} · ELO {agent.elo}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
            {(["overview", "form", "lore"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: "10px 14px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  background: "none",
                  border: "none",
                  color: tab === t ? theme.accent : "var(--text-muted)",
                  borderBottom: `2px solid ${tab === t ? theme.accent : "transparent"}`,
                  marginBottom: -1,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, minHeight: 200 }}>
            {tab === "overview" && <OverviewTab agent={agent} accent={theme.accent} />}
            {tab === "form" && <FormTab agent={agent} accent={theme.accent} />}
            {tab === "lore" && <LoreTab agent={agent} accent={theme.accent} />}
          </div>

          {/* Actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 20 }}>
            <Link
              href={`/play?opponent=${agent.id}`}
              style={{
                padding: "12px 16px",
                background: theme.accent,
                color: "var(--bg-primary)",
                borderRadius: 8,
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 700,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Challenge
            </Link>
            <Link
              href={`/arena?white=${agent.id}`}
              style={{
                padding: "12px 16px",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 700,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Watch in Arena
            </Link>
          </div>

          <p
            style={{
              marginTop: 14,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            Drag the card to inspect · ESC to close
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 880px) {
          .inspect-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Card faces (front + back, true 3D)
// ============================================================

function CardFace({ agent, face }: { agent: Agent; face: "front" | "back" }) {
  const theme = PERSONALITY_THEME[agent.personality];
  const isBack = face === "back";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 22,
        background: `linear-gradient(160deg, ${theme.primary} 0%, ${theme.secondary} 65%, #050507 100%)`,
        border: `1px solid ${theme.accent}55`,
        backfaceVisibility: "hidden",
        transform: isBack ? "rotateY(180deg)" : undefined,
        overflow: "hidden",
        boxShadow: `0 30px 60px -20px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* Inner border accent */}
      <div
        style={{
          position: "absolute",
          inset: 8,
          borderRadius: 16,
          border: `1px solid ${theme.accent}22`,
          pointerEvents: "none",
        }}
      />

      {/* Grid texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(0deg, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          pointerEvents: "none",
        }}
      />

      {!isBack ? (
        <>
          {/* Top label */}
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              right: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.15em",
              color: theme.accent,
              textTransform: "uppercase",
            }}
          >
            <span>STAKEMATE · 01</span>
            <span>{agent.style}</span>
          </div>

          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <AgentPortrait agent={agent} size="hero" />
          </div>

          {/* Bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 30,
                fontWeight: 800,
                color: "#fafafa",
                letterSpacing: "-0.03em",
                marginBottom: 6,
              }}
            >
              {agent.name}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 4,
                  background: `${theme.accent}22`,
                  color: theme.accent,
                  fontWeight: 700,
                }}
              >
                {agent.elo}
              </span>
              <span style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
                ELO
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Back face: lore + a small sigil watermark */}
          <div
            style={{
              padding: 28,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.25em",
                  color: theme.accent,
                  display: "block",
                  marginBottom: 12,
                }}
              >
                AGENT PROFILE
              </span>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 17,
                  lineHeight: 1.5,
                  fontStyle: "italic",
                  color: "#fafafa",
                }}
              >
                &ldquo;{agent.lore}&rdquo;
              </p>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 16,
                borderTop: `1px solid ${theme.accent}22`,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-muted)",
              }}
            >
              <span>{agent.name.toUpperCase()}</span>
              <span style={{ color: theme.accent }}>{agent.sigil}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Side panel tabs
// ============================================================

function OverviewTab({ agent, accent }: { agent: Agent; accent: string }) {
  const total = agent.wins + agent.losses + agent.draws;
  const wr = getWinRate(agent);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <StatGrid agent={agent} accent={accent} />
      <div
        style={{
          padding: 16,
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border)",
          borderRadius: 10,
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
          WIN RATE
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 800,
              color: accent,
              letterSpacing: "-0.02em",
            }}
          >
            {wr}%
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            over {total} games
          </span>
        </div>
        {/* Bar */}
        <div
          style={{
            marginTop: 12,
            height: 6,
            borderRadius: 999,
            background: "var(--bg-secondary)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${wr}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FormTab({ agent, accent }: { agent: Agent; accent: string }) {
  const recent = agent.recentResults.slice(-20);
  const streakChar = recent[recent.length - 1];
  let streakCount = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i] === streakChar) streakCount++;
    else break;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--text-muted)",
            marginBottom: 10,
          }}
        >
          LAST 20 RESULTS
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {recent.map((r, i) => (
            <span
              key={i}
              title={r === "W" ? "Win" : r === "L" ? "Loss" : "Draw"}
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                background:
                  r === "W"
                    ? `${accent}25`
                    : r === "L"
                      ? "rgba(239, 68, 68, 0.18)"
                      : "var(--bg-tertiary)",
                color: r === "W" ? accent : r === "L" ? "var(--danger)" : "var(--text-secondary)",
                border:
                  "1px solid " +
                  (r === "W" ? `${accent}55` : r === "L" ? "rgba(239,68,68,0.4)" : "var(--border)"),
              }}
            >
              {r}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          padding: 16,
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)" }}>
            CURRENT STREAK
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 4,
            }}
          >
            {streakCount} {streakChar === "W" ? "wins" : streakChar === "L" ? "losses" : "draws"}
          </div>
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 32,
            fontWeight: 800,
            color:
              streakChar === "W" ? accent : streakChar === "L" ? "var(--danger)" : "var(--text-muted)",
          }}
        >
          {streakChar}
        </div>
      </div>
    </div>
  );
}

function LoreTab({ agent, accent }: { agent: Agent; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontStyle: "italic",
          lineHeight: 1.55,
          color: "var(--text-primary)",
        }}
      >
        &ldquo;{agent.lore}&rdquo;
      </p>
      <div
        style={{
          padding: 16,
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          ENGINE
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          Minimax search at depth <span style={{ color: accent }}>{agent.depth}</span> with{" "}
          <span style={{ color: accent }}>{agent.personality}</span> personality bonuses applied to
          move ordering. Runs server-side on every move.
        </p>
      </div>
    </div>
  );
}

function StatGrid({ agent, accent }: { agent: Agent; accent: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1,
        background: "var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <Stat label="Wins" value={agent.wins} color={accent} />
      <Stat label="Losses" value={agent.losses} color="var(--danger)" />
      <Stat label="Draws" value={agent.draws} color="var(--text-secondary)" />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "var(--bg-tertiary)", padding: "14px 8px", textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 20,
          fontWeight: 700,
          color,
          marginBottom: 2,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.15em",
          color: "var(--text-muted)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}
