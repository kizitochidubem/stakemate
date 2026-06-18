"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          Something broke
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
          The arena hit an unexpected error. You can retry or head back home.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "var(--bg-primary)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
