import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 24,
          background: "var(--bg-primary)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--accent)",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}
        >
          404
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 800,
            color: "var(--text-primary)",
            marginBottom: 10,
          }}
        >
          This page doesn&apos;t exist
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28, maxWidth: 380 }}>
          The match or page you&apos;re looking for may have expired or never existed.
        </p>
        <Link
          href="/arena"
          style={{
            padding: "12px 28px",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 8,
            background: "var(--accent)",
            color: "var(--bg-primary)",
            textDecoration: "none",
          }}
        >
          Back to the Arena
        </Link>
      </main>
    </>
  );
}
