"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Download,
  Library,
  Loader2,
  Mail,
  PartyPopper,
} from "lucide-react";
import { confirmOrder, resendDownloads, resolveDownloadUrl } from "@/lib/api";
import { track } from "@/lib/analytics";
import { formatMoney } from "@/lib/format";
import type { OrderConfirmation } from "@/lib/types";
import { Reveal } from "@/components/motion/Reveal";

function ThankYouContent() {
  const params = useSearchParams();
  // Accept either ?order=<id> (real Shopify order) or ?cart=<id> (mock demo).
  const lookupId = params.get("order") ?? params.get("cart");

  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );

  const emailCopy = async () => {
    if (!confirmation?.email || emailState === "sending") return;
    setEmailState("sending");
    try {
      await resendDownloads(confirmation.email);
    } finally {
      setEmailState("sent");
    }
  };

  useEffect(() => {
    if (!lookupId) {
      setError("No order reference was provided.");
      return;
    }
    let active = true;
    (async () => {
      try {
        const data = await confirmOrder(lookupId);
        if (active) setConfirmation(data);
        // Count the purchase once per order, even across page refreshes.
        try {
          const key = `luts:purchase-tracked:${data.orderId}`;
          if (!window.sessionStorage.getItem(key)) {
            window.sessionStorage.setItem(key, "1");
            track("purchase", { path: "/thank-you" });
          }
        } catch {
          /* storage unavailable — skip dedupe, don't break the page */
        }
      } catch {
        if (active) setError("We couldn't find that order.");
      }
    })();
    return () => {
      active = false;
    };
  }, [lookupId]);

  if (error) {
    return (
      <div className="container-xl pt-36 pb-28 sm:pt-44">
        <Reveal className="mx-auto max-w-md">
          <div className="glass flex flex-col items-center gap-5 rounded-3xl px-8 py-16 text-center">
            <p className="text-lg text-slate2">{error}</p>
            <Link href="/" className="btn-grade">
              Back home
            </Link>
          </div>
        </Reveal>
      </div>
    );
  }

  if (!confirmation) {
    return (
      <div className="container-xl grid min-h-[60vh] place-items-center pt-36">
        <Loader2 className="h-6 w-6 animate-spin text-slate2" />
      </div>
    );
  }

  return (
    <div className="container-xl pt-36 pb-28 sm:pt-44">
      <Reveal className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="grid h-16 w-16 place-items-center rounded-full bg-sky text-white"
          >
            <PartyPopper className="h-8 w-8" />
          </motion.span>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tightest text-graphite sm:text-5xl">
            Thank you!
          </h1>
          <p className="mt-3 text-slate2">
            Your order is confirmed — download your looks right now,{" "}
            <span className="text-graphite">no account needed</span>.
          </p>
          {confirmation.email && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate2">
              <Mail className="h-4 w-4 text-sky" /> A copy was emailed to{" "}
              <span className="text-graphite">{confirmation.email}</span>.
            </p>
          )}
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-cloud px-3 py-1 text-xs text-slate2">
            Order ref
            <span className="break-all font-mono text-graphite">
              {confirmation.orderId}
            </span>
          </p>
        </div>

        {/* Summary */}
        <div className="glass mt-10 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold text-graphite">
            Order summary
          </h2>
          <ul className="mt-4 divide-y divide-hairline">
            {confirmation.lines.map((line, i) => (
              <li
                key={`${line.title}-${i}`}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span className="min-w-0 truncate text-graphite">
                  {line.title}
                  {line.quantity > 1 && (
                    <span className="text-slate2"> × {line.quantity}</span>
                  )}
                </span>
                {line.price && (
                  <span className="shrink-0 font-medium text-graphite">
                    {formatMoney(line.price)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4 text-base font-semibold text-graphite">
            <span>Total</span>
            <span>{formatMoney(confirmation.total)}</span>
          </div>
        </div>

        {/* Downloads */}
        {confirmation.downloads.length > 0 && (
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-graphite">
                Your downloads
              </h2>
              {confirmation.email && (
                <button
                  type="button"
                  onClick={emailCopy}
                  disabled={emailState !== "idle"}
                  className="btn-ghost text-sm disabled:opacity-60"
                >
                  {emailState === "sent" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-sky" /> Sent to your
                      inbox
                    </>
                  ) : emailState === "sending" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" /> Email me a copy
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {confirmation.downloads.map((dl, i) => (
                <div
                  key={`${dl.title}-${i}`}
                  className="glass glass-hover flex items-center justify-between gap-4 rounded-2xl p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline bg-cloud text-sky">
                      <Download className="h-5 w-5" />
                    </span>
                    <span className="truncate font-medium text-graphite">
                      {dl.title}
                    </span>
                  </div>
                  <motion.a
                    href={resolveDownloadUrl(dl.downloadUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileTap={{ scale: 0.97 }}
                    className="btn-grade shrink-0"
                  >
                    <Download className="h-4 w-4" /> Download
                  </motion.a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="inline-flex items-center gap-2 text-sm text-slate2">
            <CheckCircle2 className="h-4 w-4 text-sky" />
            Your download links don&apos;t require an account.
          </p>
          <Link href="/account" className="btn-ghost">
            <Library className="h-4 w-4" /> Have an account? View your library
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="container-xl grid min-h-[60vh] place-items-center pt-36">
          <Loader2 className="h-6 w-6 animate-spin text-slate2" />
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  );
}
