import Link from "next/link";
import { Logo } from "./Logo";

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/collections/cinematic", label: "Cinematic" },
      { href: "/collections/dji-osmo", label: "DJI / OSMO" },
      { href: "/collections/drone-dji", label: "Drone / DJI" },
      { href: "/collections/mobile-capcut", label: "Mobile / CapCut" },
      { href: "/collections/film-emulation", label: "Film Emulation" },
      { href: "/collections/bundles", label: "Bundles" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/help", label: "Help Center" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/policies/privacy", label: "Privacy" },
      { href: "/policies/terms", label: "Terms" },
      { href: "/policies/refund", label: "Refund" },
      { href: "/policies/license", label: "License" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-hairline bg-cloud">
      <div className="container-xl py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Luts.shop home">
              <Logo />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-slate2">
              Cinematic color in one drag. Hand-crafted LUTs for filmmakers,
              editors and creators.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-slate2">
                {col.title}
              </h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-slate2 transition-colors hover:text-graphite"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-hairline pt-5 text-xs text-slate2 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Luts.shop. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/policies/terms" className="transition-colors hover:text-graphite">
              Terms
            </Link>
            <Link href="/policies/privacy" className="transition-colors hover:text-graphite">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
