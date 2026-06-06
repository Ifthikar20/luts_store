"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/format";

const links = [
  { href: "/collections/cinematic", label: "Cinematic" },
  { href: "/collections/moody", label: "Moody" },
  { href: "/collections/vibrant", label: "Vibrant" },
  { href: "/collections/bundles", label: "Bundles" },
];

export function Nav() {
  const reduced = useReducedMotion() ?? false;
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, openCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={reduced ? false : { y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <nav
        className={cn(
          "container-xl mt-3 flex items-center justify-between rounded-full border transition-all duration-300",
          scrolled
            ? "border-white/10 bg-ink/70 py-2.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
            : "border-transparent bg-transparent py-4",
        )}
      >
        <Link href="/" className="flex items-center gap-2.5 pl-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-grade-teal-orange text-ink">
            <span className="font-display text-sm font-black">L</span>
          </span>
          <span className="font-display text-base font-bold tracking-tight text-white">
            The Looks Lab
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 pr-1">
          <Link
            href="/account"
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.1] hover:text-white sm:inline-flex"
            aria-label={user ? "Your account" : "Sign in"}
          >
            <User className="h-[18px] w-[18px]" />
            {user ? "Account" : "Sign in"}
          </Link>
          <button
            type="button"
            onClick={openCart}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white transition-colors hover:bg-white/[0.1]"
            aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-grade-teal-orange px-1 text-[11px] font-bold text-ink">
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="container-xl mt-2 md:hidden"
        >
          <div className="glass flex flex-col gap-1 rounded-3xl p-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.06]"
              >
                {l.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-white/10" />
            <Link
              href="/account"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.06]"
            >
              <User className="h-[18px] w-[18px]" />
              {user ? "Account" : "Sign in"}
            </Link>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
