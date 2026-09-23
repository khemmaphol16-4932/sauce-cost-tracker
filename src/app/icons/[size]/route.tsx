import { ImageResponse } from "next/og";

// Android's "Install app" prompt needs 192px and 512px icons in the manifest;
// icon.tsx (64px) and apple-icon.tsx (180px) alone don't qualify. Served under
// /icons so the proxy's auth redirect never intercepts them (see proxy.ts).
const SIZES = [192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.includes(size as (typeof SIZES)[number])) {
    return new Response("Not found", { status: 404 });
  }

  // Full-bleed background with the mark inside the central 80% safe zone, so
  // the same image works as a "maskable" icon (Android crops it to a circle).
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: size * 0.5,
          fontWeight: 700,
          background: "#1e1e1e",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#00e5ff",
        }}
      >
        O
      </div>
    ),
    { width: size, height: size }
  );
}
