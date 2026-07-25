import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kotori — Japanese Light Novel & EPUB Reader",
  description:
    "The all-in-one Japanese reading platform. Upload EPUB novels and read with built-in dictionary, grammar analysis, and instant lookup.",
  keywords: [
    "Japanese",
    "novel",
    "reader",
    "EPUB",
    "dictionary",
    "learning",
    "AI",
  ],
};

import { DictionaryPrewarmer } from "@/components/DictionaryPrewarmer";

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
      </head>
      <body className="min-h-screen antialiased">
        <DictionaryPrewarmer />
        {children}
      </body>
    </html>
  );
}
