import { Noto_Serif_JP, Noto_Sans_JP } from "next/font/google";

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  preload: false,
  variable: "--font-noto-serif-jp",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-jp",
});

export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${notoSerifJP.variable} ${notoSansJP.variable}`} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
