import Link from "next/link";
import { NewsletterSignup } from "./NewsletterSignup";

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/collections/cinematic", label: "Cinematic" },
      { href: "/collections/moody", label: "Moody & Dark" },
      { href: "/collections/vibrant", label: "Vibrant" },
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
    <footer className="relative z-10 border-t border-white/10 bg-ink">
      <div className="container-xl py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-grade-teal-orange text-ink">
                <span className="font-display text-sm font-black">L</span>
              </span>
              <span className="font-display text-base font-bold text-white">
                The Looks Lab
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-white/50">
              Cinematic color in one drag. Hand-crafted LUTs for filmmakers,
              editors and creators.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-white/65 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter signup */}
        <div className="mt-14 border-t border-white/10 pt-10">
          <NewsletterSignup />
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} The Looks Lab. All rights reserved.</p>
          <p>Built with Next.js · A premium color-grading storefront.</p>
        </div>
      </div>
    </footer>
  );
}
