import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://readkotori.vercel.app";
const SITE_NAME = "Kotori";
const SITE_TITLE = "Kotori: Japanese Light Novel & EPUB Reader";
const SITE_DESCRIPTION =
  "The all-in-one Japanese reading platform. Upload EPUB novels and read with built-in dictionary, grammar analysis, and instant lookup.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "Japanese",
    "novel",
    "reader",
    "EPUB",
    "dictionary",
    "learning",
    "AI",
  ],
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "GANTI_DENGAN_KODE_VERIFIKASI_GOOGLE",
  },
};

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

import { DictionaryPrewarmer } from "@/components/DictionaryPrewarmer";
import { WebMcpTools } from "@/components/WebMcpTools";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <DictionaryPrewarmer />
        <WebMcpTools />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
