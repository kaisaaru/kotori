import type { MetadataRoute } from "next";

const SITE_URL = "https://readkotori.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dict-cache-v1.json"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
