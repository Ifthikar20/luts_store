"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { subscribeNewsletter } from "@/lib/api";
import { cn } from "@/lib/format";

// On-brand newsletter signup. Posts to the non-enumerating /api/newsletter
// endpoint and shows a single generic success message regardless of whether the
// address was already subscribed. Used in the Footer (and optionally elsewhere).
export function NewsletterSignup({
  className,
  heading = "Join the color list",
  subtext = "New LUT drops, grading tips and subscriber-only deals. No spam — unsubscribe anytime.",
}: {
  className?: string;
  heading?: string;
  subtext?: string;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await subscribeNewsletter(email);
      setMessage(res.detail);
    } catch {
      // Keep the failure generic — never enumerate.
      setError("Couldn't sign you up just now. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("", className)}>
      <h4 className="font-display text-base font-semibold text-graphite">
        {heading}
      </h4>
      <p className="mt-2 max-w-sm text-sm text-slate2">{subtext}</p>

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
            noValidate
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
                <Send className="h-4 w-4" />
              )}
              Subscribe
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
