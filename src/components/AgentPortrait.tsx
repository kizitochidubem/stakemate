"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Agent, getAgentById } from "@/lib/agents";
import { getAgentVisual, getPortraitFallbackChain } from "@/lib/agent-portraits";
import { PERSONALITY_THEME } from "@/lib/agent-theme";

type PortraitSize = "compact" | "card" | "hero";

const SIZE: Record<PortraitSize, { box: number; face: number; bodyH: number }> = {
  compact: { box: 40, face: 28, bodyH: 36 },
  card: { box: 140, face: 72, bodyH: 120 },
  hero: { box: 200, face: 96, bodyH: 170 },
};

interface AgentPortraitProps {
  agent: Agent;
  size?: PortraitSize;
  className?: string;
  showBotFrame?: boolean;
}

/**
 * Agent identity: profile face (X / NFT / bot avatar) on a stylized agent body.
 */
export default function AgentPortrait({
  agent,
  size = "card",
  className,
  showBotFrame = true,
}: AgentPortraitProps) {
  const theme = PERSONALITY_THEME[agent.personality];
  const visual = getAgentVisual(agent);
  const fallbacks = useMemo(
    () => getPortraitFallbackChain(agent, visual),
    [agent, visual]
  );
  const [portraitIndex, setPortraitIndex] = useState(0);
  const portraitSrc = fallbacks[portraitIndex] ?? fallbacks[0];
  const dim = SIZE[size];
  const isCompact = size === "compact";

  const handlePortraitError = () => {
    setPortraitIndex((i) => (i + 1 < fallbacks.length ? i + 1 : i));
  };

  return (
    <div
      className={className}
      style={{
        width: dim.box,
        height: isCompact ? dim.box : dim.bodyH,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {showBotFrame && !isCompact && (
        <svg
          viewBox="0 0 100 120"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
          aria-hidden
        >
          <defs>
            <linearGradient id={`body-${agent.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.primary} />
              <stop offset="100%" stopColor={theme.secondary} />
            </linearGradient>
          </defs>
          <path
            d="M22 42 Q50 28 78 42 L82 95 Q50 108 18 95 Z"
            fill={`url(#body-${agent.id})`}
            opacity="0.85"
          />
          <rect x="38" y="18" width="24" height="8" rx="3" fill={theme.accent} opacity="0.5" />
          <circle cx="50" cy="12" r="4" fill={theme.accent} opacity="0.8" />
          <line x1="50" y1="8" x2="50" y2="2" stroke={theme.accent} strokeWidth="2" />
          <circle cx="50" cy="2" r="2" fill={theme.accent} className="animate-pulse" />
        </svg>
      )}

      {showBotFrame && isCompact && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 8,
            background: `linear-gradient(145deg, ${theme.primary}, ${theme.secondary})`,
            border: `1px solid ${theme.accent}40`,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: isCompact ? "50%" : "38%",
          transform: "translate(-50%, -50%)",
          width: dim.face,
          height: dim.face,
          borderRadius: "50%",
          overflow: "hidden",
          border: `2px solid ${theme.accent}`,
          boxShadow: `0 0 20px ${theme.glow}`,
          background: theme.secondary,
          zIndex: 2,
        }}
      >
        <Image
          src={portraitSrc}
          alt={`${agent.name} portrait`}
          width={dim.face}
          height={dim.face}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          unoptimized={portraitSrc.endsWith(".svg")}
          onError={handlePortraitError}
        />
      </div>

      {!isCompact && (
        <span
          style={{
            position: "absolute",
            bottom: 4,
            right: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 700,
            color: theme.accent,
            opacity: 0.7,
            zIndex: 3,
          }}
        >
          BOT
        </span>
      )}
    </div>
  );
}

export function AgentPortraitById({
  agentId,
  ...props
}: Omit<AgentPortraitProps, "agent"> & { agentId: string }) {
  const agent = getAgentById(agentId);
  if (!agent) return null;
  return <AgentPortrait agent={agent} {...props} />;
}
