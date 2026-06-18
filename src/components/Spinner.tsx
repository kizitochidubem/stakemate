"use client";

interface SpinnerProps {
  size?: number;
  color?: string;
}

/**
 * Inline button-friendly spinner. Pure CSS, no JS animation cost.
 */
export default function Spinner({
  size = 14,
  color = "currentColor",
}: SpinnerProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}
