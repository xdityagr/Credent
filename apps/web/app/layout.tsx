import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Serif, Outfit, Unbounded } from "next/font/google";
import { Providers } from "@/components/providers";
import { RefractionFilter } from "@/components/ui/button";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});
const unbounded = Unbounded({ subsets: ["latin"], weight: ["200", "300", "400"], variable: "--font-unbounded", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Credent: private credit, public book", template: "%s · Credent" },
  description:
    "Revenue-based credit for businesses. Prove revenue with a zero-knowledge proof, borrow from lender-run pools, and repay from a lockbox. The loan book is public on Solana.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${instrument.variable} ${unbounded.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <RefractionFilter />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
