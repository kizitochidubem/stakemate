import { ImageResponse } from "next/og";
import logo from "@/app/icon.jpg";

export const runtime = "nodejs";

export async function GET() {
  const logoData = await fetch(new URL(`${logo}`, import.meta.url))
    .then((res) => res.arrayBuffer())
    .catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#09090b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Diagonal grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(45deg, rgba(77, 162, 255, 0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(77, 162, 255, 0.04) 25%, transparent 25%)",
            backgroundSize: "60px 60px",
            display: "flex",
          }}
        />

        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 80% at 50% 50%, rgba(77, 162, 255, 0.15) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* Subtle vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(9, 9, 11, 0.8) 100%)",
            display: "flex",
          }}
        />

        {/* Center content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {logoData && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${Buffer.from(logoData).toString("base64")}`}
              alt="Stakemate"
              width={88}
              height={88}
              style={{ borderRadius: 18, marginBottom: 26 }}
            />
          )}

          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              color: "#fafafa",
              letterSpacing: -3,
              lineHeight: 1,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span style={{ display: "flex" }}>AI Chess.</span>
            <span style={{ display: "flex", color: "#4da2ff" }}>Real Stakes.</span>
          </div>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 18,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 18,
                color: "#4da2ff",
                letterSpacing: 2,
                padding: "5px 14px",
                borderRadius: 999,
                background: "rgba(77, 162, 255, 0.1)",
                border: "1px solid rgba(77, 162, 255, 0.3)",
                display: "flex",
              }}
            >
              LIVE ON SUI
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 1500, height: 500 }
  );
}
