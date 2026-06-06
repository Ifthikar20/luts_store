import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";

// Shared shell for legal/policy pages: breadcrumb, title, "last updated" line,
// a prominent "not legal advice — have counsel review" disclaimer, and a
// readable prose column. Children are the policy body sections.
export function PolicyLayout({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden pb-28">
      <div className="container-xl relative pt-36 sm:pt-44">
        <Reveal>
          <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate2">
            <Link href="/" className="hover:text-graphite">
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-graphite">{title}</span>
          </nav>
          <h1 className="font-display text-4xl font-bold tracking-tightest text-graphite sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm text-slate2">
            Last updated: {lastUpdated}
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate2">{intro}</p>

          <div className="mt-8 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <strong className="font-semibold">Please note:</strong> This document
            is generic placeholder template text provided for convenience only.
            It is <em>not</em> legal advice and may not reflect the laws that
            apply to you. Have it reviewed and adapted by qualified legal counsel
            before relying on it.
          </div>
        </Reveal>
      </div>

      <Reveal className="container-xl relative mt-14">
        <div className="max-w-2xl space-y-8 leading-relaxed text-slate2">
          {children}
        </div>
      </Reveal>
    </div>
  );
}

// A titled section block used inside PolicyLayout for consistent spacing.
export function PolicySection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-graphite">
        {heading}
      </h2>
      <div className="space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}
