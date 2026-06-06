"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Download,
  Library,
  Loader2,
  LogOut,
  UserCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getMyDownloads, resolveDownloadUrl } from "@/lib/api";
import type { DownloadItem } from "@/lib/types";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { ResendDownloads } from "@/components/account/ResendDownloads";

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AccountPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [items, setItems] = useState<DownloadItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setError(null);
    (async () => {
      try {
        const data = await getMyDownloads();
        if (active) setItems(data);
      } catch {
        if (active) setError("Couldn't load your library. Please try again.");
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  // While hydrating the session, show a quiet placeholder.
  if (authLoading) {
    return (
      <div className="container-xl grid min-h-[60vh] place-items-center pt-36">
        <Loader2 className="h-6 w-6 animate-spin text-slate2" />
      </div>
    );
  }

  // Not signed in -> prompt to log in.
  if (!user) {
    return (
      <div className="container-xl pt-36 pb-28 sm:pt-44">
        <Reveal className="mx-auto max-w-md">
          <div className="glass flex flex-col items-center gap-5 rounded-3xl px-8 py-16 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-hairline bg-cloud">
              <Library className="h-7 w-7 text-slate2" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold text-graphite">
                Your download library
              </h1>
              <p className="mt-2 text-sm text-slate2">
                Sign in to access every LUT you&apos;ve purchased.
              </p>
            </div>
            <Link href="/account/login?next=/account" className="btn-grade">
              Sign in
            </Link>
          </div>

          <ResendDownloads className="mt-6" />
        </Reveal>
      </div>
    );
  }

  return (
    <div className="container-xl pt-36 pb-28 sm:pt-44">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tightest text-graphite sm:text-5xl">
              My downloads
            </h1>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate2">
              <UserCircle2 className="h-4 w-4" />
              {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="btn-ghost"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </Reveal>

      {error && (
        <p className="glass mt-10 rounded-3xl border-red-200 bg-red-50 px-6 py-5 text-sm text-red-600">
          {error}
        </p>
      )}

      {!error && items === null && (
        <div className="mt-16 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate2" />
        </div>
      )}

      {!error && items !== null && items.length === 0 && (
        <div className="glass mt-12 flex flex-col items-center gap-5 rounded-3xl px-8 py-20 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border border-hairline bg-cloud">
            <Library className="h-7 w-7 text-slate2" />
          </span>
          <p className="text-lg text-slate2">
            Your library is empty — once you buy a look it lands here.
          </p>
          <Link href="/collections/cinematic" className="btn-grade">
            Browse the looks
          </Link>
        </div>
      )}

      {!error && items !== null && items.length > 0 && (
        <StaggerGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <StaggerItem
              key={item.productHandle}
              as="article"
              className="glass glass-hover flex flex-col gap-4 rounded-3xl p-6"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky text-white">
                  <Download className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-semibold text-graphite">
                    {item.title}
                  </h2>
                  <p className="truncate text-xs text-slate2">
                    {item.productHandle}
                  </p>
                </div>
              </div>

              <p className="inline-flex items-center gap-1.5 text-xs text-slate2">
                <Clock className="h-3.5 w-3.5" />
                Link expires {formatExpiry(item.expiresAt)}
              </p>

              <motion.a
                href={resolveDownloadUrl(item.downloadUrl)}
                target="_blank"
                rel="noopener noreferrer"
                whileTap={{ scale: 0.97 }}
                className="btn-grade mt-auto w-full"
              >
                <Download className="h-4 w-4" /> Download
              </motion.a>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  );
}
