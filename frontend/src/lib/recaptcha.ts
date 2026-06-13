/**
 * Google reCAPTCHA v3 (invisible) token helper.
 *
 * `executeRecaptcha(action)` lazy-loads Google's script once (only when a site
 * key is configured) and returns a fresh, short-lived token for the given
 * action. The backend verifies it (common/recaptcha.py). When no site key is
 * set it resolves to `undefined` and the backend skips the check — so dev and
 * un-keyed deploys are unaffected.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined" || !SITE_KEY) return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("reCAPTCHA failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export async function executeRecaptcha(
  action: string,
): Promise<string | undefined> {
  if (!SITE_KEY || typeof window === "undefined") return undefined;
  try {
    await loadScript();
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha) return undefined;
    return await new Promise<string>((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(SITE_KEY, { action }).then(resolve, reject);
      });
    });
  } catch {
    // Never block the user on a reCAPTCHA hiccup — the backend fails open too.
    return undefined;
  }
}
