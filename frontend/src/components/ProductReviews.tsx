"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, ThumbsUp, Flag, Trash2 } from "lucide-react";
import {
  createReview,
  deleteReview,
  getReviews,
  reportReview,
  voteReviewHelpful,
} from "@/lib/api";
import type { Review, ReviewSort, ReviewsResponse } from "@/lib/types";

function Stars({
  rating,
  className = "",
  size = "h-3.5 w-3.5",
}: {
  rating: number;
  className?: string;
  size?: string;
}) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size} ${
            i <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-slate-300"
          }`}
        />
      ))}
    </div>
  );
}

/** Compact "x months/years ago" from an ISO date. */
function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function RatingPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          onClick={() => onChange(i)}
          className="p-0.5"
        >
          <Star
            className={`h-5 w-5 ${
              i <= value
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-slate-300 hover:text-amber-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewRow({
  r,
  onHelpful,
  onReport,
  onDelete,
}: {
  r: Review;
  onHelpful: (id: string) => void;
  onReport: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [reported, setReported] = useState(false);
  return (
    <li className="border-t border-hairline py-4 first:border-t-0">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cloud text-xs font-semibold text-graphite">
          {r.name.charAt(0).toUpperCase()}
        </span>
        <span className="font-semibold text-graphite">{r.name}</span>
        {r.verified && (
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            Verified
          </span>
        )}
        <Stars rating={r.rating} className="ml-1" />
        <span className="ml-auto text-xs text-slate2">{relativeDate(r.date)}</span>
      </div>
      {r.title && (
        <p className="mt-1.5 text-sm font-semibold text-graphite">{r.title}</p>
      )}
      <p className="mt-1 text-sm leading-relaxed text-slate2">{r.body}</p>

      {/* Actions */}
      <div className="mt-2 flex items-center gap-4 text-xs text-slate2">
        <button
          type="button"
          onClick={() => onHelpful(r.id)}
          className={`inline-flex items-center gap-1.5 transition-colors hover:text-graphite ${
            r.youVoted ? "font-semibold text-sky" : ""
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          Helpful{r.helpfulCount > 0 ? ` (${r.helpfulCount})` : ""}
        </button>
        {r.yours ? (
          <button
            type="button"
            onClick={() => onDelete(r.id)}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        ) : (
          <button
            type="button"
            disabled={reported}
            onClick={() => {
              onReport(r.id);
              setReported(true);
            }}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-graphite disabled:opacity-60"
          >
            <Flag className="h-3.5 w-3.5" /> {reported ? "Reported" : "Report"}
          </button>
        )}
      </div>
    </li>
  );
}

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "helpful", label: "Most helpful" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export function ProductReviews({ handle }: { handle: string }) {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterRating, setFilterRating] = useState(0); // 0 = all
  const [sort, setSort] = useState<ReviewSort>("recent");

  // write-form state
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getReviews(handle, sort).then((r) => alive && setData(r));
    return () => {
      alive = false;
    };
  }, [handle, sort]);

  const filtered = useMemo(() => {
    const list = data?.reviews ?? [];
    return filterRating ? list.filter((r) => r.rating === filterRating) : list;
  }, [data, filterRating]);

  const visible = expanded ? filtered : filtered.slice(0, 3);

  if (!data) return null;
  const { average, count, canReview } = data;

  function patchReview(id: string, patch: Partial<Review>) {
    setData((d) =>
      d
        ? { ...d, reviews: d.reviews.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
        : d,
    );
  }

  async function refresh() {
    setData(await getReviews(handle, sort));
  }

  async function onHelpful(id: string) {
    try {
      const res = await voteReviewHelpful(id);
      patchReview(id, { youVoted: res.youVoted, helpfulCount: res.helpfulCount });
    } catch {
      /* likely not signed in — silently ignore */
    }
  }

  async function onReport(id: string) {
    try {
      await reportReview(id);
    } catch {
      /* ignore */
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteReview(id);
      await refresh();
    } catch {
      /* ignore */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!body.trim()) {
      setError("Please write a short review.");
      return;
    }
    setSaving(true);
    try {
      await createReview(handle, { rating, title: title.trim(), body: body.trim() });
      await refresh();
      setShowForm(false);
      setTitle("");
      setBody("");
      setRating(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="reviews" className="mt-16 border-t border-hairline pt-8">
      {/* Header: title + inline aggregate. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-display text-xl font-bold tracking-tight text-graphite">
          Reviews
        </h2>
        {count > 0 ? (
          <span className="flex items-center gap-1.5 text-sm text-slate2">
            <strong className="text-graphite">{average.toFixed(1)}</strong>
            <Stars rating={average} />· {count} verified
          </span>
        ) : (
          <span className="text-sm text-slate2">No reviews yet</span>
        )}
        {canReview && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="ml-auto rounded-full border border-hairline px-3 py-1 text-sm font-medium text-graphite hover:bg-cloud"
          >
            Write a review
          </button>
        )}
      </div>

      {/* Write form — only for a verified buyer. */}
      {showForm && (
        <form onSubmit={submit} className="mt-4 rounded-2xl border border-hairline bg-cloud/50 p-4">
          <RatingPicker value={rating} onChange={setRating} />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={140}
            className="mt-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-graphite focus:outline-none focus:ring-2 focus:ring-sky/40"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="How did these LUTs work for you?"
            rows={3}
            maxLength={5000}
            className="mt-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-graphite focus:outline-none focus:ring-2 focus:ring-sky/40"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-graphite px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Posting…" : "Post review"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-slate2 hover:text-graphite"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Controls: rating filter + sort. */}
      {count > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {[0, 5, 4, 3, 2, 1].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setFilterRating(n);
                setExpanded(false);
              }}
              aria-pressed={filterRating === n}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                filterRating === n
                  ? "border-transparent bg-graphite text-white"
                  : "border-hairline text-slate2 hover:bg-cloud"
              }`}
            >
              {n === 0 ? "All" : `${n} ★`}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as ReviewSort);
              setExpanded(false);
            }}
            aria-label="Sort reviews"
            className="ml-auto rounded-full border border-hairline bg-white px-3 py-1 text-xs text-graphite focus:outline-none focus:ring-2 focus:ring-sky/40"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* List. */}
      {count > 0 && (
        <>
          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-slate2">
              No {filterRating}-star reviews yet.
            </p>
          ) : (
            <ul className="mt-4">
              {visible.map((r) => (
                <ReviewRow
                  key={r.id}
                  r={r}
                  onHelpful={onHelpful}
                  onReport={onReport}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
          {filtered.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-sm font-medium text-sky hover:underline"
            >
              {expanded ? "Show fewer" : `Show all ${filtered.length} reviews`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
