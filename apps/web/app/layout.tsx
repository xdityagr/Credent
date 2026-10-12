import type { Metadata } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import { DemoDock } from "@/components/DemoDock";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Credent: private credit, public book",
  description:
    "Revenue-based credit where borrowers prove revenue with zero-knowledge proofs and the loan book, tranches and default waterfall are public.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="pb-28">
        <Providers>
          <Nav />
          <main className="mx-auto max-w-[1240px] px-5 pt-10 md:px-8">{children}</main>
          <DemoDock />
        </Providers>
      </body>
    </html>
  );
}
