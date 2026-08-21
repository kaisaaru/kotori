import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kotori: Japanese Light Novel & EPUB Reader",
    short_name: "Kotori",
    description:
      "The all-in-one Japanese reading platform. Upload EPUB novels and read with built-in dictionary, grammar analysis, and instant lookup.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
