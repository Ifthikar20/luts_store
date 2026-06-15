import type { Metadata } from "next";
import { getBlogPosts } from "@/lib/api";
import { BlogCard } from "@/components/BlogCard";
import { Reveal } from "@/components/motion/Reveal";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog — Color grading guides & LUT tips",
  description:
    "Plain-English guides on LUTs and color grading: what a LUT is, why you need one, and how to get a cinematic look in any editor.",
  alternates: { canonical: absoluteUrl("/blog") },
  openGraph: {
    title: `Blog — ${SITE_NAME}`,
    description:
      "Plain-English guides on LUTs and color grading for creators.",
    url: absoluteUrl("/blog"),
  },
};

export default async function BlogIndexPage() {
  const posts = await getBlogPosts();

  return (
    <div className="container-xl pt-36 pb-28 sm:pt-44">
      <Reveal>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate2">
          The Looks Lab Journal
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tightest text-graphite sm:text-6xl">
          Color, simply explained
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate2">
          Short, practical guides on LUTs and color grading — so you can make
          every shot look its best, faster.
        </p>
      </Reveal>

      {posts.length === 0 ? (
        <div className="glass mt-12 rounded-3xl px-8 py-16 text-center text-slate2">
          No articles yet — check back soon.
        </div>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article key={post.slug} className="h-full">
              <BlogCard post={post} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
