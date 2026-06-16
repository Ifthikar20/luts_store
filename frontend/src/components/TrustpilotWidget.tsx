"use client";

import { useEffect, useRef } from "react";

/**
 * Trustpilot TrustBox — third-party VERIFIED reviews widget.
 *
 * Renders only when NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID is configured;
 * otherwise it shows nothing (so the page stays clean before Trustpilot is set
 * up). The bootstrap script is loaded once and the box is (re)initialised on
 * mount via window.Trustpilot.loadFromElement so it works with client-side
 * navigation. Pass `sku` on a product page to scope a product-reviews template.
 */
const BUSINESS_UNIT_ID =
  process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID || "";
const TEMPLATE_ID = process.env.NEXT_PUBLIC_TRUSTPILOT_TEMPLATE_ID || "";
const REVIEW_DOMAIN = process.env.NEXT_PUBLIC_TRUSTPILOT_DOMAIN || "";
const SCRIPT_SRC =
  "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";

declare global {
  interface Window {
    Trustpilot?: { loadFromElement: (el: HTMLElement, force?: boolean) => void };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Trustpilot) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve(); // don't block the page on a widget failure
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TrustpilotWidget({
  sku,
  className,
  height = "140px",
}: {
  sku?: string;
  className?: string;
  height?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!BUSINESS_UNIT_ID) return;
    let cancelled = false;
    loadScript().then(() => {
      if (!cancelled && ref.current && window.Trustpilot) {
        window.Trustpilot.loadFromElement(ref.current, true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Not configured yet — render nothing.
  if (!BUSINESS_UNIT_ID || !TEMPLATE_ID) return null;

  return (
    <div className={className}>
      <div
        ref={ref}
        className="trustpilot-widget"
        data-locale="en-US"
        data-template-id={TEMPLATE_ID}
        data-businessunit-id={BUSINESS_UNIT_ID}
        data-style-height={height}
        data-style-width="100%"
        data-theme="light"
        {...(sku ? { "data-sku": sku } : {})}
      >
        {REVIEW_DOMAIN && (
          <a
            href={`https://www.trustpilot.com/review/${REVIEW_DOMAIN}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Trustpilot
          </a>
        )}
      </div>
    </div>
  );
}
