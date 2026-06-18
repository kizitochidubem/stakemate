import { ImageResponse } from "next/og";
import { getArchivedMatch } from "@/lib/server/matches";
import logo from "@/app/icon.jpg"

export const runtime = "nodejs";
export const alt = "Stakemate match result";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function MatchOgImage({
  params,
}: {
  params: { id: string };
}) {
  const match = await getArchivedMatch(params.id);

  const winner =
    match?.result === "white"
      ? match.whiteAgent.name
      : match?.result === "black"
        ? match.blackAgent.name
        : null;
  const headline = winner ? `${winner} wins` : "Draw";
  const subhead = match
    ? `${match.whiteAgent.name} vs ${match.blackAgent.name}`
    : "Match not found";

  const logoData = await fetch(
    new URL(`${logo}`, import.meta.url)
  )
    .then((res) => res.arrayBuffer())
    .catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#09090b",
          color: "#fafafa",
          position: "relative",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 50% at 50% 35%, rgba(77, 162, 255, 0.12) 0%, transparent 70%)",
          }}
        />

        {/* Bordered card */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            border: "1px solid #27272a",
            borderRadius: 16,
            display: "flex",
          }}
        />

        {/* Top bar: logo + ticker */}
        <div
          style={{
            position: "absolute",
            top: 70,
            left: 70,
            right: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {logoData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${Buffer.from(logoData).toString("base64")}`}
                alt="Stakemate"
                width={36}
                height={36}
                style={{ borderRadius: 8 }}
              />
            )}
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#fafafa",
                letterSpacing: -0.5,
              }}
            >
              STAKEMATE
            </span>
          </div>
            <span
              style={{
                fontSize: 16,
                color: "#4da2ff",
                letterSpacing: 2,
              }}
            >
              SUI
            </span>
        </div>

        {/* Center content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            margin: "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Result pill */}
          <div
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              background: winner
                ? "rgba(77, 162, 255, 0.12)"
                : "rgba(82, 82, 91, 0.2)",
              border: `1px solid ${winner ? "rgba(77, 162, 255, 0.3)" : "#52525b"}`,
              fontSize: 16,
              color: winner ? "#4da2ff" : "#a1a1aa",
              letterSpacing: 2,
              marginBottom: 28,
              display: "flex",
            }}
          >
            {winner ? "MATCH SETTLED" : "DRAW"}
          </div>

          {/* Winner / Draw headline */}
          <div
            style={{
              fontSize: 100,
              fontWeight: 800,
              color: "#fafafa",
              letterSpacing: -3,
              lineHeight: 1,
              textAlign: "center",
              display: "flex",
            }}
          >
            {headline}
          </div>

          {/* Subhead */}
          <div
            style={{
              marginTop: 28,
              fontSize: 32,
              color: "#a1a1aa",
              display: "flex",
            }}
          >
            {subhead}
          </div>

          {/* Match stats */}
          {match && (
            <div
              style={{
                marginTop: 36,
                display: "flex",
                gap: 32,
                fontSize: 18,
                color: "#52525b",
              }}
            >
              <span style={{ display: "flex" }}>{match.moves.length} moves</span>
              <span style={{ display: "flex" }}>·</span>
              <span style={{ display: "flex" }}>
                ELO {match.whiteAgent.elo} vs {match.blackAgent.elo}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 70,
            left: 70,
            right: 70,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 16,
            color: "#52525b",
            letterSpacing: 1,
          }}
        >
          <span>STAKEMATE</span>
          <span>The Chess Arena For Agents</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
