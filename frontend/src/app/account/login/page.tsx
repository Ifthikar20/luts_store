"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Reveal } from "@/components/motion/Reveal";

// Human-readable copy for the ?error= codes the OAuth callback can redirect with.
const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "Your sign-in session expired. Please try again.",
  missing_code: "Sign-in was cancelled or incomplete. Please try again.",
  token_exchange_failed: "We couldn't complete sign-in with Shopify. Please try again.",
  missing_id_token: "Shopify didn't return your identity. Please try again.",
  invalid_id_token: "We couldn't verify your Shopify sign-in. Please try again.",
};

function AccountAuthForm() {
  const reduced = useReducedMotion() ?? false;
  const router = useRouter();
  const params = useSearchParams();
  const { authenticated, login, completeMockLogin } = useAuth();

  const next = params.get("next") || "/account";
  const errorCode = params.get("error");

  const [error, setError] = useState<string | null>(
    errorCode ? (ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Please try again.") : null,
  );
  const [submitting, setSubmitting] = useState(false);
  // When the backend reports MOCK mode we reveal a clearly-labeled demo email
  // field that stands in for the hosted Shopify login (local dev only).
  const [mockMode, setMockMode] = useState(false);
  const [email, setEmail] = useState("");

  // Already authenticated -> bounce to the intended destination.
  useEffect(() => {
    if (authenticated) router.replace(next);
  }, [authenticated, next, router]);

  // "Continue with Shopify". REAL mode redirects the browser to hosted Shopify
  // login; MOCK mode flips us into the demo email step instead.
  async function onContinue() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(next);
      if (res.mode === "mock") {
        setMockMode(true);
      }
      // For "shopify" mode the browser is already navigating to Shopify.
    } catch {
      setError("Couldn't start sign-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // MOCK-only demo sign-in: complete the local session for the entered email.
  async function onMockSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    setSubmitting(true);
    try {
      await completeMockLogin(email);
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Demo sign-in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-xl pt-36 pb-28 sm:pt-44">
      <Reveal className="mx-auto max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate2 transition-colors hover:text-graphite"
        >
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <div className="glass rounded-3xl p-7 sm:p-9">
          <h1 className="font-display text-3xl font-bold tracking-tightest text-graphite">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-slate2">
            Access your download library with your Shopify customer account.
            Signing in is optional — you can always buy and download as a guest.
          </p>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={reduced ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                role="alert"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {!mockMode ? (
            <button
              type="button"
              onClick={onContinue}
              disabled={submitting}
              className="btn-grade mt-7 w-full disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <Lock className="h-4 w-4" /> Continue with Shopify
            </button>
          ) : (
            <form onSubmit={onMockSubmit} className="mt-7 space-y-4" noValidate>
              <p className="rounded-2xl border border-hairline bg-cloud px-4 py-3 text-xs text-slate2">
                Demo mode — no Shopify credentials are configured. Enter any
                email to simulate the Shopify customer sign-in locally.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate2">
                  Demo sign-in email
                </span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate2" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-hairline bg-white py-3 pl-10 pr-4 text-sm text-graphite placeholder:text-slate2 outline-none transition-colors focus:border-sky focus:ring-2 focus:ring-sky/30"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="btn-grade w-full disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue
              </button>
            </form>
          )}
        </div>
      </Reveal>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-xl pt-44" />}>
      <AccountAuthForm />
    </Suspense>
  );
}
