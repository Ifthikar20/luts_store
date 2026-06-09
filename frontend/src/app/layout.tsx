import type { Metadata, Viewport } from "next";
// next/font self-hosts this at build time. If the build machine has no network
// access, the Apple system stack in tailwind.config.ts (-apple-system, …) takes
// over — which renders as real San Francisco on Apple devices.
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { PageTransition } from "@/components/PageTransition";

// Inter — a free, open-source near-clone of Apple's San Francisco (SF Pro) —
// used site-wide for headings and body. Exposed on one CSS variable that every
// Tailwind font family points at; the system SF stack is the fallback.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
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
    <html lang="en" className={sans.variable}>
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
