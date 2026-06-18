"use client";

import { useRef, useState, MouseEvent } from "react";
import { Agent } from "@/lib/agents";
import { PERSONALITY_THEME } from "@/lib/agent-theme";
import AgentInspectModal from "./AgentInspectModal";
import AgentPortrait from "./AgentPortrait";

export type AgentStatus = "ready" | "thinking" | "playing" | "idle";

interface AgentCardProps {
  agent: Agent;
  side?: "white" | "black";
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  status?: AgentStatus;
}

export { PERSONALITY_THEME } from "@/lib/agent-theme";

/**
 * Tilt-on-mouse card. Tracks mouse position over the card and applies
 * a 3D rotateX/rotateY transform. A subtle highlight follows the cursor
 * for a holographic "trading card" feel. Pure CSS - no canvas, no WebGL.
 */
function useTilt() {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>("");
  const [highlight, setHighlight] = useState<{ x: number; y: number } | null>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    // Tilt range: ±8deg
    const ry = (px - 0.5) * 12;
    const rx = (0.5 - py) * 12;
    setTransform(`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(2px)`);
    setHighlight({ x: px * 100, y: py * 100 });
  };

  const onLeave = () => {
    setTransform("");
    setHighlight(null);
  };

  return { ref, transform, highlight, onMove, onLeave };
}

export default function AgentCard({
  agent,
  side,
  selected = false,
  onClick,
  compact = false,
  status = "ready",
}: AgentCardProps) {
  const theme = PERSONALITY_THEME[agent.personality];
  const [inspecting, setInspecting] = useState(false);
  const tilt = useTilt();

  // === Compact (used in modal pick lists, arena swap, etc) ===
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          background: selected ? "var(--bg-tertiary)" : "transparent",
          border: "none",
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <CompactAvatar agent={agent} selected={selected} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
                letterSpacing: "-0.01em",
              }}
            >
              {agent.name}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 600,
                color: theme.accent,
                flexShrink: 0,
              }}
            >
              {agent.elo}
            </span>
          </div>
          <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {agent.style}
          </span>
        </div>
      </button>
    );
  }

  // === Premium portrait card ===
  return (
    <>
      <div
        ref={tilt.ref}
        onMouseMove={tilt.onMove}
        onMouseLeave={tilt.onLeave}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{
          position: "relative",
          height: 320,
          borderRadius: 18,
          cursor: onClick ? "pointer" : "default",
          overflow: "hidden",
          transform: tilt.transform,
          transition: tilt.transform
            ? "transform 0.05s linear, box-shadow 0.3s"
            : "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s",
          background: `linear-gradient(145deg, ${theme.primary} 0%, ${theme.secondary} 65%, #0a0a0c 100%)`,
          border: selected ? `1px solid ${theme.accent}` : "1px solid var(--border)",
          boxShadow: selected
            ? `0 0 0 1px ${theme.accent}, 0 20px 40px -10px ${theme.glow}`
            : `0 12px 28px -12px rgba(0, 0, 0, 0.5)`,
          willChange: "transform",
        }}
      >
        {/* Holographic highlight that follows cursor */}
        {tilt.highlight && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(420px circle at ${tilt.highlight.x}% ${tilt.highlight.y}%, rgba(255,255,255,0.10), transparent 40%)`,
              pointerEvents: "none",
              mixBlendMode: "screen",
            }}
          />
        )}

        {/* Subtle grid texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(0deg, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.6,
            pointerEvents: "none",
          }}
        />

        {/* Portrait + bot frame */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -52%)",
            pointerEvents: "none",
          }}
        >
          <AgentPortrait agent={agent} size="card" />
        </div>

        {/* Top row: side badge + status pill */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            right: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {side ? <SideBadge side={side} /> : <span />}
          <StatusPill status={status} accent={theme.accent} />
        </div>

        {/* Bottom panel: name, ELO, style */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "18px 18px 56px",
            background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 800,
              color: "#fafafa",
              letterSpacing: "-0.025em",
              marginBottom: 6,
            }}
          >
            {agent.name}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 700,
                color: theme.accent,
                padding: "2px 8px",
                borderRadius: 4,
                background: `${theme.accent}1a`,
                border: `1px solid ${theme.accent}40`,
              }}
            >
              {agent.elo}
            </span>
            <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.15)" }} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "rgba(255, 255, 255, 0.7)",
                letterSpacing: "0.14em",
              }}
            >
              {agent.style}
            </span>
          </div>
        </div>

        {/* Inspect button (bottom corner) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setInspecting(true);
          }}
          style={{
            position: "absolute",
            bottom: 14,
            right: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 11px",
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "#fafafa",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.1em",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          INSPECT
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {inspecting && (
        <AgentInspectModal
          agent={agent}
          onClose={() => setInspecting(false)}
        />
      )}
    </>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function CompactAvatar({ agent, selected }: { agent: Agent; selected: boolean }) {
  const theme = PERSONALITY_THEME[agent.personality];
  return (
    <div
      style={{
        flexShrink: 0,
        borderRadius: 8,
        border: `1px solid ${selected ? theme.accent : "var(--border)"}`,
        overflow: "hidden",
      }}
    >
      <AgentPortrait agent={agent} size="compact" />
    </div>
  );
}

function SideBadge({ side }: { side: "white" | "black" }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.14em",
        padding: "3px 8px",
        borderRadius: 4,
        background: side === "white" ? "#fafafa" : "rgba(0, 0, 0, 0.5)",
        color: side === "white" ? "#09090b" : "#fafafa",
        border: side === "black" ? "1px solid rgba(255,255,255,0.2)" : "none",
        textTransform: "uppercase",
        backdropFilter: side === "black" ? "blur(8px)" : undefined,
      }}
    >
      {side}
    </span>
  );
}

function StatusPill({ status, accent }: { status: AgentStatus; accent: string }) {
  const isLive = status === "thinking" || status === "playing";
  const labels = { ready: "READY", thinking: "THINKING", playing: "PLAYING", idle: "IDLE" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${isLive ? accent : "rgba(255,255,255,0.15)"}`,
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.12em",
        color: isLive ? accent : "rgba(255, 255, 255, 0.7)",
      }}
    >
      <span
        className={isLive ? "animate-pulse" : ""}
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: isLive ? accent : "rgba(255, 255, 255, 0.5)",
        }}
      />
      {labels[status]}
    </span>
  );
}
