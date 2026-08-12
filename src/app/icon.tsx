import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          background: "#1e1e1e",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#00e5ff",
          borderRadius: 14,
        }}
      >
        O
      </div>
    ),
    { ...size }
  );
}
