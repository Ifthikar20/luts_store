"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * Tracks a page_view on every client-side route change (and the initial load).
 * The document referrer is only attached to the first view of the session's
 * page load — subsequent SPA navigations carry no referrer.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const firstView = useRef(true);

  useEffect(() => {
    if (!pathname) return;
    track("page_view", {
      path: pathname,
      referrer: firstView.current ? document.referrer || undefined : undefined,
    });
    firstView.current = false;
  }, [pathname]);

  return null;
}
