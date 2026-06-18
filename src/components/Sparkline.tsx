"use client";

interface SparklineProps { results: ("W" | "L" | "D")[]; }

export default function Sparkline({ results }: SparklineProps) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 16 }}>
      {results.map((r, i) => (
        <div
          key={i}
          style={{
            width: 3, borderRadius: 1,
            height: r === "W" ? 16 : r === "L" ? 5 : 10,
            background: r === "W" ? "var(--accent)" : r === "L" ? "var(--danger)" : "var(--text-muted)",
          }}
        />
      ))}
    </div>
  );
}
