"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { submitContact } from "@/lib/api";

// On-brand contact form. Posts to /api/contact (validated + throttled
// server-side). Does light client-side validation, then surfaces the API's
// generic success message or a friendly error state.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/40 backdrop-blur-xl transition-colors focus:border-white/25 focus:bg-white/[0.06] focus:outline-none";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return "Please tell us your name.";
    if (!EMAIL_RE.test(email.trim()))
      return "Please enter a valid email address.";
    if (message.trim().length < 10)
      return "Please add a little more detail to your message.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await submitContact({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });
      setDone(res.detail);
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

  return (
    <div className="glass rounded-3xl p-6 sm:p-8">
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-10 text-center"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full border border-grade-teal/30 bg-grade-teal/10">
              <CheckCircle2 className="h-7 w-7 text-grade-teal" />
            </span>
            <h2 className="font-display text-xl font-semibold text-white">
              Message sent
            </h2>
            <p className="max-w-sm text-sm text-white/55">{done}</p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={onSubmit}
            className="flex flex-col gap-5"
            noValidate
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                  Name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  aria-label="Your name"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  className={inputClass}
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Message
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                aria-label="Message"
                rows={6}
                className={inputClass + " resize-y"}
              />
            </label>

            {error && (
              <p
                className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200/90"
                role="alert"
              >
                {error}
              </p>
            )}

            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.98 }}
              className="btn-grade self-start disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send message
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
