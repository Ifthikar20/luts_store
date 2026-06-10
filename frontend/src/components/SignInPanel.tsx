"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Gift, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { SocialProvider } from "@/lib/types";

// The OAuth redirect lands back here; this exact path must be registered as an
// allowed redirect URI in the Google / Apple console.
const CALLBACK_PATH = "/account/login";
const OAUTH_KEY = "luts:oauth";

function authorizeUrlClientId(provider: SocialProvider): string | undefined {
  return provider === "google"
    ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    : process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
}

function authorizeUrl(provider: SocialProvider, nextPath: string): string | null {
  const clientId = authorizeUrlClientId(provider);
  if (!clientId) return null;

  const nonce =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Math.random());
  try {
    sessionStorage.setItem(
      OAUTH_KEY,
      JSON.stringify({ provider, next: nextPath, nonce }),
    );
  } catch {
    /* storage blocked — sign-in can still proceed, just no post-redirect route */
  }

  const redirectUri = window.location.origin + CALLBACK_PATH;
  if (provider === "google") {
    const p = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      nonce,
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  }
  // Apple
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "id_token",
    response_mode: "fragment",
    scope: "email",
    nonce,
  });
  return `https://appleid.apple.com/auth/authorize?${p}`;
}

/**
 * Google / Apple sign-in panel.
 *
 * - Configured (NEXT_PUBLIC_*_CLIENT_ID set): the button redirects straight to
 *   the provider's hosted sign-in; on return, the id_token in the URL fragment
 *   is read here and exchanged for a session.
 * - Not configured: a dev fallback collects an email and signs in with a
 *   "mock:<email>" token (the backend only trusts it when unconfigured).
 *
 * Either way, signing in opts into deals + the biweekly free LUT.
 */
export function SignInPanel({ onDone }: { onDone?: () => void }) {
  const reduced = useReducedMotion() ?? false;
  const router = useRouter();
  const { signIn } = useAuth();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [email, setEmail] = useState("");
  const [needEmail, setNeedEmail] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = (p: SocialProvider) => Boolean(authorizeUrlClientId(p));

  // Handle the provider redirect: read the id_token from the URL fragment.
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash) return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const idToken = hash.get("id_token");
    if (!idToken) return;
    let stored: { provider?: SocialProvider; next?: string } = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(OAUTH_KEY) || "{}");
      sessionStorage.removeItem(OAUTH_KEY);
    } catch {
      /* ignore */
    }
    // Clear the token from the address bar immediately.
    history.replaceState(null, "", window.location.pathname + window.location.search);
    const provider = stored.provider ?? "google";
    setPending(provider);
    signIn(provider, idToken)
      .then(() => (stored.next ? router.replace(stored.next) : onDone?.()))
      .catch(() => {
        setError("Sign-in failed. Please try again.");
        setPending(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start(provider: SocialProvider) {
    setError(null);
    const url = authorizeUrl(provider, window.location.pathname);
    if (url) {
      // Configured -> go straight to the provider's hosted sign-in.
      window.location.assign(url);
      return;
    }
    // Dev fallback: collect an email and use a mock token.
    setNeedEmail(provider);
  }

  async function complete(e: React.FormEvent) {
    e.preventDefault();
    if (!needEmail || !email.trim()) return;
    setPending(needEmail);
    setError(null);
    try {
      await signIn(needEmail, `mock:${email.trim()}`);
      onDone?.();
    } catch {
      setError("Sign-in failed. Please try again.");
      setPending(null);
    }
  }

  return (
    <div>
      {/* Value prop — why sign in. */}
      <div className="flex items-start gap-3 rounded-2xl bg-sky/5 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-sky" />
        <p className="text-sm text-slate2">
          Sign in to buy — and get the{" "}
          <span className="font-semibold text-graphite">best deals</span> plus a{" "}
          <span className="font-semibold text-graphite">free LUT every two weeks</span>,
          straight to your inbox.
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={reduced ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {!needEmail ? (
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => start("google")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-hairline bg-white px-6 py-3 text-sm font-semibold text-graphite shadow-soft transition-colors hover:bg-cloud"
          >
            <GoogleGlyph /> Continue with Google
          </button>
          <button
            type="button"
            onClick={() => start("apple")}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <AppleGlyph /> Continue with Apple
          </button>
        </div>
      ) : (
        <form onSubmit={complete} className="mt-6 space-y-3">
          <p className="rounded-2xl border border-hairline bg-cloud px-4 py-3 text-xs text-slate2">
            {configured(needEmail)
              ? "Confirm the email for your account."
              : `Demo mode — ${needEmail} isn't configured. Enter any email to sign in locally.`}
          </p>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-full border border-hairline bg-white px-5 py-3 text-sm text-graphite placeholder:text-slate2 outline-none focus:border-sky focus:ring-2 focus:ring-sky/30"
          />
          <button
            type="submit"
            disabled={pending !== null}
            className="btn-grade w-full disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              setNeedEmail(null);
              setEmail("");
            }}
            className="w-full text-center text-xs text-slate2 hover:text-graphite"
          >
            ← Choose a different method
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-3.9 6.8-9.7 6.8-17.4z"/>
      <path fill="#FBBC05" d="M10.4 28.3a14.5 14.5 0 0 1 0-8.6l-7.9-6.1a24 24 0 0 0 0 20.8l7.9-6.1z"/>
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.3-5.7c-2 1.4-4.7 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 1.43c.06 1.04-.34 2.06-1 2.82-.69.79-1.83 1.4-2.94 1.31-.08-1 .42-2.06 1.04-2.74.69-.77 1.9-1.36 2.9-1.39zM20.5 17.2c-.55 1.27-.82 1.83-1.53 2.95-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.05-1.77-4.04-3.32-2.77-4.35-3.06-9.45-1.35-12.16C2.55 6.27 4.4 5.16 6.14 5.16c1.77 0 2.88 1 4.34 1 1.42 0 2.28-1 4.33-1 1.55 0 3.19.85 4.36 2.3-3.83 2.1-3.21 7.57.33 9.74z"/>
    </svg>
  );
}
