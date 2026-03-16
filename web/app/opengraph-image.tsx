import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Signal Eye — Spot emerging trends before they peak";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f8fbff 0%, #e8f0fe 40%, #dce8f8 100%)",
          padding: "60px 80px",
          fontFamily: '"DM Sans", "Helvetica Neue", sans-serif',
          position: "relative",
        }}
      >
        {/* Subtle accent glow */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-60px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(12,102,228,0.08) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            left: "-40px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(87,157,255,0.06) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Logo + brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "36px",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="48" fill="#0c66e4" />
            <path
              d="M30 60 L42 40 L54 52 L70 28"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="70" cy="28" r="6" fill="white" />
          </svg>
          <span
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#172b4d",
              letterSpacing: "-0.01em",
            }}
          >
            Signal Eye
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            maxWidth: "900px",
          }}
        >
          <div
            style={{
              fontSize: "56px",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              color: "#172b4d",
              marginBottom: "8px",
              display: "flex",
            }}
          >
            Spot the next big thing
          </div>
          <div
            style={{
              fontSize: "56px",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              background: "linear-gradient(90deg, #0c66e4 0%, #579dff 100%)",
              backgroundClip: "text",
              color: "transparent",
              display: "flex",
            }}
          >
            before everyone else does.
          </div>
        </div>

        {/* Subheadline */}
        <p
          style={{
            fontSize: "22px",
            lineHeight: 1.5,
            color: "#626f86",
            textAlign: "center",
            maxWidth: "700px",
            marginTop: "24px",
            marginBottom: "36px",
          }}
        >
          22+ live data sources. Momentum scoring. Breakout predictions.
        </p>

        {/* CTA button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 40px",
            borderRadius: "8px",
            background: "linear-gradient(90deg, #0c66e4 0%, #579dff 100%)",
            color: "#ffffff",
            fontSize: "20px",
            fontWeight: 600,
            letterSpacing: "-0.005em",
            boxShadow: "0 2px 12px rgba(12,102,228,0.25)",
          }}
        >
          Start for free →
        </div>
      </div>
    ),
    { ...size }
  );
}
