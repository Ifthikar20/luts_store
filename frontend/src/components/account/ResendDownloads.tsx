"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { resendDownloads } from "@/lib/api";
import { cn } from "@/lib/format";

// "Resend my download links" — a minimal, non-auth recovery affordance.
//
// The backend is NON-ENUMERATING: it always returns the same generic message
// whether or not the email has purchases. We surface that message verbatim and
// never reveal account existence. Lives on the logged-out /account view so a
// buyer who lost their email can recover their links.
export function ResendDownloads({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await resendDownloads(email);
      // Show the API's generic, non-enumerating message verbatim.
      setMessage(res.detail);
    } catch {
      // Even on failure, keep the response generic (no enumeration leakage).
      setMessage(
        "If that email has purchases, we've resent your download links.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("text-center", className)}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-slate2 underline-offset-4 transition-colors hover:text-graphite hover:underline"
        >
          Lost your downloads? Resend my links
        </button>
      ) : (
        <div className="glass rounded-3xl p-6 text-left">
          <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold text-graphite">
            <Mail className="h-4 w-4 text-sky" />
            Resend my download links
          </h2>
          <p className="mt-1.5 text-xs text-slate2">
            Enter the email you purchased with and we&apos;ll resend your most
            recent order&apos;s download links.
          </p>

          <AnimatePresence mode="wait">
            {message ? (
              <motion.p
                key="done"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-sm text-sky"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {message}
              </motion.p>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={onSubmit}
                className="mt-4 flex flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  className="w-full flex-1 rounded-full border border-hairline bg-white px-4 py-3 text-sm text-graphite placeholder:text-slate2 transition-colors focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
                />
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileTap={{ scale: 0.97 }}
                  className="btn-grade shrink-0 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Resend
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
