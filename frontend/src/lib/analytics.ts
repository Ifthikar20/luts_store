// First-party, privacy-light analytics.
//
// Sends allowlisted funnel events (page_view, add_to_cart, begin_checkout,
// purchase) to the BFF's /api/events endpoint with an anonymous session id —
// no cookies, no IP/user-agent storage, no third-party scripts. Fire-and-forget:
// failures are swallowed so tracking can never break the storefront.
import { API_URL } from "./api";

const SESSION_KEY = "luts:analytics-session";

export type EventName =
  | "page_view"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase";

function sessionId(): string {
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().replace(/-/g, "")
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous"; // storage unavailable (private mode) — still count it
  }
}

export function track(
  name: EventName,
  props: { path?: string; handle?: string; referrer?: string } = {},
): void {
  if (typeof window === "undefined") return;
  try {
    void fetch(`${API_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: sessionId(), events: [{ name, ...props }] }),
      // keepalive lets the request survive page navigations (e.g. the redirect
      // to Stripe right after begin_checkout).
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never break the UI for analytics */
  }
}
