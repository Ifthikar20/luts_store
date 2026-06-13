"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Clock,
  Download,
  Library,
  Loader2,
  LogOut,
  Mail,
  Settings as SettingsIcon,
  UserCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getMyDownloads,
  getPreferences,
  resendDownloads,
  resolveDownloadUrl,
  updatePreferences,
} from "@/lib/api";
import type { AccountPreferences, DownloadItem } from "@/lib/types";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { ResendDownloads } from "@/components/account/ResendDownloads";

function formatDate(iso: string, withTime = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(
    undefined,
    withTime
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" },
  );
}

type Tab = "downloads" | "settings";

export default function AccountPage() {
  const { customer, authenticated, loading: authLoading, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("downloads");
  const [items, setItems] = useState<DownloadItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
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
  }, [authenticated]);

  // Order the library alphabetically by title so it reads as a clean, stable
  // list rather than raw purchase order.
  const orderedItems = useMemo(
    () =>
      items ? [...items].sort((a, b) => a.title.localeCompare(b.title)) : items,
    [items],
  );

  if (authLoading) {
    return (
      <div className="container-xl grid min-h-[60vh] place-items-center pt-36">
        <Loader2 className="h-6 w-6 animate-spin text-slate2" />
      </div>
    );
  }

  // Not signed in -> prompt to log in.
  if (!authenticated) {
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
                Sign in with Google or Apple to access every LUT you&apos;ve
                purchased — plus the best deals and a free LUT every two weeks.
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
      {/* Header */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tightest text-graphite sm:text-5xl">
              My account
            </h1>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate2">
              <UserCircle2 className="h-4 w-4" />
              {customer?.email}
            </p>
          </div>
          <button type="button" onClick={() => logout()} className="btn-ghost">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 border-b border-hairline">
          <TabButton
            active={tab === "downloads"}
            onClick={() => setTab("downloads")}
            icon={<Download className="h-4 w-4" />}
            label="Downloads"
            count={items?.length}
          />
          <TabButton
            active={tab === "settings"}
            onClick={() => setTab("settings")}
            icon={<SettingsIcon className="h-4 w-4" />}
            label="Settings"
          />
        </div>
      </Reveal>

      {tab === "downloads" ? (
        <DownloadsTab items={orderedItems} error={error} />
      ) : (
        <SettingsTab email={customer?.email ?? ""} onSignOut={() => logout()} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-sky text-graphite"
          : "border-transparent text-slate2 hover:text-graphite"
      }`}
    >
      {icon}
      {label}
      {count != null && count > 0 && (
        <span className="rounded-full bg-cloud px-1.5 text-xs text-slate2">
          {count}
        </span>
      )}
    </button>
  );
}

function DownloadsTab({
  items,
  error,
}: {
  items: DownloadItem[] | null;
  error: string | null;
}) {
  if (error) {
    return (
      <p className="glass mt-10 rounded-3xl border-red-200 bg-red-50 px-6 py-5 text-sm text-red-600">
        {error}
      </p>
    );
  }
  if (items === null) {
    return (
      <div className="mt-16 grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate2" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
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
    );
  }
  return (
    <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <StaggerItem
          key={item.productHandle}
          as="article"
          className="glass glass-hover flex flex-col gap-4 rounded-3xl p-6"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky text-white">
              <Download className="h-5 w-5" />
            </span>
            <h2 className="min-w-0 truncate font-display text-lg font-semibold text-graphite">
              {item.title}
            </h2>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs text-slate2">
            <Clock className="h-3.5 w-3.5" />
            Link expires {formatDate(item.expiresAt)}
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
  );
}

function SettingsTab({
  email,
  onSignOut,
}: {
  email: string;
  onSignOut: () => void;
}) {
  const [prefs, setPrefs] = useState<AccountPreferences | null>(null);
  const [savingMarketing, setSavingMarketing] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );

  useEffect(() => {
    let active = true;
    getPreferences()
      .then((p) => active && setPrefs(p))
      .catch(() => active && setPrefs(null));
    return () => {
      active = false;
    };
  }, []);

  const toggleMarketing = async () => {
    if (!prefs || savingMarketing) return;
    setSavingMarketing(true);
    try {
      const next = await updatePreferences({
        marketingEmails: !prefs.marketingEmails,
      });
      setPrefs(next);
    } finally {
      setSavingMarketing(false);
    }
  };

  const resendAll = async () => {
    if (!email || resendState === "sending") return;
    setResendState("sending");
    try {
      await resendDownloads(email);
    } finally {
      setResendState("sent");
    }
  };

  return (
    <div className="mt-10 max-w-2xl space-y-6">
      {/* Profile */}
      <section className="glass rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-graphite">
          Profile
        </h2>
        <dl className="mt-4 divide-y divide-hairline text-sm">
          <div className="flex items-center justify-between py-3">
            <dt className="text-slate2">Email</dt>
            <dd className="font-medium text-graphite">{email}</dd>
          </div>
          {prefs?.memberSince && (
            <div className="flex items-center justify-between py-3">
              <dt className="text-slate2">Member since</dt>
              <dd className="font-medium text-graphite">
                {formatDate(prefs.memberSince, false)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Email preferences */}
      <section className="glass rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-graphite">
          Email preferences
        </h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-graphite">Marketing emails</p>
            <p className="text-sm text-slate2">
              Deals, new releases, and the free LUT every two weeks.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!prefs?.marketingEmails}
            disabled={!prefs || savingMarketing}
            onClick={toggleMarketing}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              prefs?.marketingEmails ? "bg-sky" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                prefs?.marketingEmails
                  ? "translate-x-[22px]"
                  : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Download links */}
      <section className="glass rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-graphite">
          Download links
        </h2>
        <p className="mt-1 text-sm text-slate2">
          Send fresh links for every look you own to your email.
        </p>
        <button
          type="button"
          onClick={resendAll}
          disabled={resendState !== "idle"}
          className="btn-ghost mt-4 disabled:opacity-60"
        >
          {resendState === "sent" ? (
            <>
              <Check className="h-4 w-4 text-sky" /> Sent to {email}
            </>
          ) : resendState === "sending" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" /> Email me my downloads
            </>
          )}
        </button>
      </section>

      {/* Session */}
      <section className="glass rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-graphite">
          Session
        </h2>
        <p className="mt-1 text-sm text-slate2">
          Sign out of this device. Your purchases stay in your library.
        </p>
        <button type="button" onClick={onSignOut} className="btn-ghost mt-4">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>
    </div>
  );
}
