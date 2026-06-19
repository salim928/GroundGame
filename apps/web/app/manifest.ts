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
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
