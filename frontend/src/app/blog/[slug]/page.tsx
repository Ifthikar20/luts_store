import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { getBlogPost, getBlogPosts } from "@/lib/api";
import { JsonLd } from "@/components/JsonLd";
import { Reveal } from "@/components/motion/Reveal";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Article not found" };
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url,
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
    },
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { dateStyle: "long" });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const url = absoluteUrl(`/blog/${post.slug}`);
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage ? [post.coverImage] : undefined,
    datePublished: post.publishedAt ?? undefined,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: url,
  };

  return (
    <div className="container-xl pt-36 pb-28 sm:pt-44">
      <JsonLd data={articleJsonLd} />
      <article className="mx-auto max-w-2xl">
        <Reveal>
          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate2 transition-colors hover:text-graphite"
          >
            <ArrowLeft className="h-4 w-4" /> All articles
          </Link>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tightest text-graphite sm:text-5xl">
            {post.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate2">
            <span>{post.author}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(post.publishedAt)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {post.readingTime} min read
            </span>
          </div>
        </Reveal>

        {post.coverImage && (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-3xl bg-cloud">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              priority
              className="object-cover"
            />
          </div>
        )}

        {/* Body — rendered from Markdown server-side (trusted admin authors). */}
        <div
          className="blog-prose mt-10"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />

        <div className="mt-14 border-t border-hairline pt-8 text-center">
          <p className="text-slate2">
            Ready to grade faster?{" "}
            <Link href="/luts/the-everything-bundle" className="font-semibold text-sky">
              Get every look →
            </Link>
          </p>
        </div>
      </article>
    </div>
  );
}
