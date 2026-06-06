"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Reveal } from "@/components/motion/Reveal";

type Mode = "login" | "register";

function AccountAuthForm() {
  const reduced = useReducedMotion() ?? false;
  const router = useRouter();
  const params = useSearchParams();
  const { user, login, register } = useAuth();

  const initialMode: Mode =
    params.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = params.get("next") || "/account";

  // Already authenticated -> bounce to the intended destination.
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "register") await register(email, password);
      else await login(email, password);
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
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
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate2">
            {mode === "login"
              ? "Sign in to access your download library."
              : "Sign up to keep every look you buy in one place."}
          </p>

          {/* Tabs */}
          <div className="mt-6 grid grid-cols-2 rounded-full border border-hairline bg-cloud p-1">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="relative rounded-full px-4 py-2 text-sm font-medium transition-colors"
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-tab"
                    transition={{ duration: reduced ? 0 : 0.3 }}
                    className="absolute inset-0 rounded-full bg-white shadow-soft"
                  />
                )}
                <span
                  className={
                    mode === m ? "relative text-graphite" : "relative text-slate2"
                  }
                >
                  {m === "login" ? "Sign in" : "Sign up"}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate2">
                Email
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

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate2">
                Password
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate2" />
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-hairline bg-white py-3 pl-10 pr-4 text-sm text-graphite placeholder:text-slate2 outline-none transition-colors focus:border-sky focus:ring-2 focus:ring-sky/30"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
              {mode === "register" && (
                <span className="mt-1.5 block text-xs text-slate2">
                  At least 8 characters. Avoid common or all-numeric passwords.
                </span>
              )}
            </label>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={reduced ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={submitting}
              className="btn-grade w-full disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate2">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="text-sky underline-offset-2 hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-sky underline-offset-2 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
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
