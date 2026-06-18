"use client";

const PIECE_LABELS: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

interface CapturedGraveyardProps {
  captured: string[];
  side: "white" | "black";
  label?: string;
}

export default function CapturedGraveyard({ captured, side, label }: CapturedGraveyardProps) {
  return (
    <div style={{ padding: "0 4px" }}>
      {label && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            letterSpacing: "0.2em",
            display: "block",
            marginBottom: 6,
            color: "var(--text-muted)",
          }}
        >
          {label}
        </span>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minHeight: 24 }}>
        {captured.length === 0 ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>
            --
          </span>
        ) : (
          captured.map((piece, i) => (
            <span
              key={`${piece}-${i}`}
              style={{
                fontSize: 14,
                opacity: 0.4,
                color:
                  side === "white"
                    ? "var(--text-primary)"
                    : "var(--accent-dim)",
              }}
            >
              {PIECE_LABELS[piece.toLowerCase()] ?? piece}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
