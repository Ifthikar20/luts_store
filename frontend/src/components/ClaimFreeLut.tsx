"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2 } from "lucide-react";
import { claimFreeLut } from "@/lib/api";
import { track } from "@/lib/analytics";

/**
 * Email-claim form for a FREE product (price 0). Free items skip the cart and
 * Stripe entirely — claiming creates the download grant + receipt email and
 * routes to the same thank-you/download page a purchase uses.
 */
export function ClaimFreeLut() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      track("add_to_cart", { handle: "free-lut" }); // funnel: free claim intent
      const { orderId } = await claimFreeLut(email.trim());
      router.push(`/thank-you?order=${encodeURIComponent(orderId)}`);
    } catch {
      setError("We couldn't process that just now. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="free-email" className="text-sm font-medium text-graphite">
        Free this week — get it sent to your inbox:
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="free-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-full border border-hairline bg-white px-5 py-3 text-sm text-graphite placeholder:text-slate2 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-sky px-7 py-3 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(0,113,227,0.25)] transition-colors hover:bg-sky-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gift className="h-4 w-4" />
          )}
          {busy ? "Sending…" : "Get it free"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate2">
        No payment required. We&rsquo;ll email your download link.
      </p>
    </form>
  );
}
