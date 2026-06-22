import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GroundGame — Delegate Mobilization",
    short_name: "GroundGame",
    description: "Delegate Mobilization & Call-Tracking Platform",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#06351C",
    theme_color: "#0A7D34",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
