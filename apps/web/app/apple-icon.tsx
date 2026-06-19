import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same NDC umbrella mark as app/icon.svg, rendered to a PNG for iOS home-screen.
const ICON_SVG = `
<svg width="180" height="180" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0A7D34"/><stop offset="1" stop-color="#064F22"/>
    </linearGradient>
    <clipPath id="dome"><path d="M116 300 A140 140 0 0 1 396 300 Z"/></clipPath>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#tile)"/>
  <g clip-path="url(#dome)">
    <rect x="116" y="150" width="70" height="160" fill="#CE1126"/>
    <rect x="186" y="150" width="70" height="160" fill="#FFFFFF"/>
    <rect x="256" y="150" width="70" height="160" fill="#111111"/>
    <rect x="326" y="150" width="70" height="160" fill="#15A34A"/>
  </g>
  <path d="M116 300 A140 140 0 0 1 396 300" fill="none" stroke="#FFFFFF" stroke-width="9"/>
  <line x1="116" y1="300" x2="396" y2="300" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round"/>
  <circle cx="256" cy="150" r="11" fill="#FFFFFF"/>
  <path d="M256 300 L256 372 Q256 402 226 402 Q202 402 202 382" fill="none" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round"/>
  <path d="M256 300 L256 372 Q256 402 226 402 Q202 402 202 382" fill="none" stroke="#111111" stroke-width="12" stroke-linecap="round"/>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          width={180}
          height={180}
          src={`data:image/svg+xml;utf8,${encodeURIComponent(ICON_SVG)}`}
          alt="NDC"
        />
      </div>
    ),
    size,
  );
}
