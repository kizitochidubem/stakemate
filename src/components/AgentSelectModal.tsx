"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent } from "@/lib/agents";
import { fetchAgentRoster } from "@/lib/agents-client";
import AgentCard from "./AgentCard";

interface AgentSelectModalProps {
  side: "white" | "black";
  excludeId: string;
  onSelect: (agent: Agent) => void;
  onClose: () => void;
}

export default function AgentSelectModal({
  side,
  excludeId,
  onSelect,
  onClose,
}: AgentSelectModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [roster, setRoster] = useState<Agent[]>([]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void fetchAgentRoster()
      .then((agents) => {
        if (!cancelled) setRoster(agents);
      })
      .catch(() => {
        if (!cancelled) setRoster([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const platformAgents = roster.filter(
    (a) => !a.id.startsWith("custom-") && a.id !== excludeId
  );

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="modal-content" style={{ borderRadius: 12, maxWidth: 480 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 20,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.2em",
                display: "block",
                marginBottom: 4,
                color: "var(--accent)",
              }}
            >
              SELECT AGENT
            </span>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {side === "white" ? "White" : "Black"} Side
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Platform agents section */}
        <div
          style={{
            padding: "10px 20px",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--text-muted)",
            background: "var(--bg-primary)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          PLATFORM AGENTS
        </div>
        <div>
          {platformAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              compact
              onClick={() => onSelect(agent)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
