import type { Metadata, Viewport } from "next";
// next/font self-hosts these at build time. If the build machine has no network
// access to fetch the font files, swap these for `next/font/local` with .woff2
// files in /public/fonts, or fall back to the system stack already declared in
// tailwind.config.ts (ui-sans-serif, system-ui).
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { PageTransition } from "@/components/PageTransition";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const siteDescription =
  "Premium cinematic LUTs for filmmakers and editors. Color grade in one drag — .cube & .3dl packs for Resolve, Premiere, Final Cut and more.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Luts.store — Cinematic LUTs",
    template: "%s | Luts.store",
  },
  description: siteDescription,
  applicationName: "Luts.store",
  icons: { icon: "/favicon.svg" },
  keywords: [
    "LUTs",
    "cinematic LUTs",
    "color grading",
    "DaVinci Resolve",
    "Premiere Pro",
    "Final Cut Pro",
    ".cube",
    "film look",
  ],
  openGraph: {
    type: "website",
    siteName: "Luts.store",
    url: siteUrl,
    title: "Luts.store — Cinematic LUTs",
    description: "Color grade in one drag. Premium cinematic LUT packs.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Luts.store — Cinematic LUTs",
    description: "Color grade in one drag. Premium cinematic LUT packs.",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="bg-paper font-sans text-graphite antialiased">
        <Providers>
          <Nav />
          <CartDrawer />
          <main className="relative z-[2] min-h-screen">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
