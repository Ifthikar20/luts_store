"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/format";

const links = [
  { href: "/collections/cinematic", label: "Cinematic" },
  { href: "/collections/moody", label: "Moody" },
  { href: "/collections/vibrant", label: "Vibrant" },
  { href: "/collections/bundles", label: "Bundles" },
];

export function Nav() {
  const reduced = useReducedMotion() ?? false;
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { count, openCart } = useCart();
  const { authenticated } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Focus the expanding search field once it opens.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    setSearchOpen(false);
    setMobileOpen(false);
  };

  return (
    <motion.header
      initial={reduced ? false : { y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <nav
        className={cn(
          "container-xl mt-3 flex items-center justify-between rounded-full transition-all duration-300",
          scrolled
            ? "border border-hairline bg-white/80 py-2.5 shadow-soft backdrop-blur-xl"
            : "border border-transparent bg-transparent py-4",
        )}
      >
        <Link href="/" className="pl-2" aria-label="Luts.store home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate2 transition-colors hover:bg-cloud hover:text-graphite"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 pr-1">
          {/* Search affordance: an icon that expands an inline input and
              navigates to /search?q=… on submit. */}
          <div className="flex items-center">
            <AnimatePresence initial={false}>
              {searchOpen && (
                <motion.form
                  role="search"
                  onSubmit={submitSearch}
                  initial={reduced ? { opacity: 0 } : { width: 0, opacity: 0 }}
                  animate={
                    reduced
                      ? { opacity: 1 }
                      : { width: "auto", opacity: 1 }
                  }
                  exit={reduced ? { opacity: 0 } : { width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onBlur={() => {
                      if (!searchValue.trim()) setSearchOpen(false);
                    }}
                    placeholder="Search looks…"
                    aria-label="Search products"
                    className="mr-1 w-40 rounded-full border border-hairline bg-white px-4 py-2 text-sm text-graphite placeholder:text-slate2 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30 sm:w-52"
                  />
                </motion.form>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => {
                if (searchOpen) submitSearch({ preventDefault() {} } as React.FormEvent);
                else setSearchOpen(true);
              }}
              className="grid h-10 w-10 place-items-center rounded-full border border-hairline bg-white text-graphite transition-colors hover:bg-cloud"
              aria-label="Search"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
          </div>
          <Link
            href="/account"
            className="hidden items-center gap-2 rounded-full border border-hairline bg-white px-4 py-2 text-sm font-medium text-graphite transition-colors hover:bg-cloud sm:inline-flex"
            aria-label={authenticated ? "Your account" : "Sign in"}
          >
            <User className="h-[18px] w-[18px]" />
            {authenticated ? "Account" : "Sign in"}
          </Link>
          <button
            type="button"
            onClick={openCart}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-hairline bg-white text-graphite transition-colors hover:bg-cloud"
            aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-sky px-1 text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-full border border-hairline bg-white text-graphite md:hidden"
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
            <form role="search" onSubmit={submitSearch} className="relative mb-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate2" />
              <input
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search looks…"
                aria-label="Search products"
                className="w-full rounded-2xl border border-hairline bg-white py-3 pl-11 pr-4 text-sm text-graphite placeholder:text-slate2 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
              />
            </form>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-graphite hover:bg-cloud"
              >
                {l.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-hairline" />
            <Link
              href="/account"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-graphite hover:bg-cloud"
            >
              <User className="h-[18px] w-[18px]" />
              {authenticated ? "Account" : "Sign in"}
            </Link>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
