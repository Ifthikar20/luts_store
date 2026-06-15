import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { BlogPostSummary } from "@/lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function BlogCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group glass glass-hover flex h-full flex-col overflow-hidden rounded-3xl"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-cloud">
        {post.coverImage && (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-center gap-2 text-xs text-slate2">
          <span>{formatDate(post.publishedAt)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {post.readingTime} min read
          </span>
        </div>
        <h3 className="font-display text-xl font-bold leading-snug tracking-tight text-graphite">
          {post.title}
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-slate2">
          {post.excerpt}
        </p>
        <span className="mt-auto pt-1 text-sm font-semibold text-sky">
          Read article →
        </span>
      </div>
    </Link>
  );
}
