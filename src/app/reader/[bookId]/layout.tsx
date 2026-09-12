import { Noto_Serif_JP } from "next/font/google";

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  preload: false,
  variable: "--font-noto-serif-jp",
});

export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={notoSerifJP.variable} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
