import type { Agent } from "./agents";

export const PERSONALITY_THEME: Record<
  Agent["personality"],
  { primary: string; secondary: string; accent: string; glow: string }
> = {
  aggressive: {
    primary: "#7a1a1a",
    secondary: "#2a0606",
    accent: "#ef4444",
    glow: "rgba(239, 68, 68, 0.35)",
  },
  defensive: {
    primary: "#1e3a5f",
    secondary: "#08141f",
    accent: "#60a5fa",
    glow: "rgba(96, 165, 250, 0.35)",
  },
  chaotic: {
    primary: "#5b2168",
    secondary: "#170822",
    accent: "#a855f7",
    glow: "rgba(168, 85, 247, 0.35)",
  },
  positional: {
    primary: "#5c4a1a",
    secondary: "#1c1606",
    accent: "#e2c56e",
    glow: "rgba(226, 197, 110, 0.35)",
  },
  sacrificial: {
    primary: "#6b1839",
    secondary: "#1f0612",
    accent: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.35)",
  },
  endgame: {
    primary: "#1a4a3a",
    secondary: "#061a14",
    accent: "#34d399",
    glow: "rgba(52, 211, 153, 0.35)",
  },
};
