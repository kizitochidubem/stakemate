"use client";

interface EvalBarProps {
  evaluation: number;
}

export default function EvalBar({ evaluation }: EvalBarProps) {
  const whitePercent = Math.max(5, Math.min(95, 50 + evaluation * 5));
  const isWhiteFavored = evaluation > 0.5;
  const isBlackFavored = evaluation < -0.5;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          letterSpacing: "0.1em",
          color: isBlackFavored ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        B
      </span>
      <div
        style={{
          width: 16,
          flex: 1,
          minHeight: 200,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-tertiary)",
          borderRadius: 4,
        }}
      >
        {/* Black side (top) */}
        <div
          style={{
            width: "100%",
            height: `${100 - whitePercent}%`,
            background: "var(--bg-tertiary)",
            transition: "height 0.7s ease-out",
          }}
        />
        {/* White side (bottom) */}
        <div
          style={{
            width: "100%",
            height: `${whitePercent}%`,
            background: isWhiteFavored
              ? "var(--text-primary)"
              : "var(--text-secondary)",
            transition: "height 0.7s ease-out",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          letterSpacing: "0.1em",
          color: isWhiteFavored ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        W
      </span>
    </div>
  );
}
