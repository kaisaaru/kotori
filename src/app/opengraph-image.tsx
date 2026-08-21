import { ImageResponse } from "next/og";

export const alt = "Kotori: Japanese Light Novel & EPUB Reader";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
          background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -2 }}>
          Kotori
        </div>
        <div style={{ fontSize: 36, marginTop: 16, opacity: 0.9 }}>
          Japanese Light Novel & EPUB Reader
        </div>
      </div>
    ),
    { ...size }
  );
}
