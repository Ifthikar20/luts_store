// Dev/offline fallback for the blog (mirrors the backend seed posts) so the
// /blog pages and the build render even when the BFF is unreachable.
import type { BlogPost, BlogPostSummary } from "./types";

const POSTS: BlogPost[] = [
  {
    slug: "what-is-a-lut",
    title: "What Is a LUT? A Plain-English Guide",
    excerpt:
      "A LUT is a one-click color preset that gives your footage a finished, cinematic look in any editor. Here's how it works — in plain English.",
    coverImage:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&q=80",
    author: "The Looks Lab",
    publishedAt: "2026-06-01T00:00:00Z",
    readingTime: 2,
    bodyHtml:
      "<p>A <strong>LUT</strong> — short for <em>Look-Up Table</em> — is a small file that tells your editor how to transform one color into another, giving your footage a finished, cinematic grade in a single click.</p><h2>The one-sentence version</h2><p>A LUT is a colour preset that works in almost any editor — drag it on, and your footage instantly takes on a deliberate look.</p><h2>LUT vs. preset</h2><p>A LUT transforms color and works across apps; a preset saves one app's sliders and is locked to it. (Full guide available once the blog API is connected.)</p>",
  },
  {
    slug: "why-you-need-luts",
    title: "Why You Need LUTs: Faster, More Consistent Color",
    excerpt:
      "LUTs save hours, keep every shot consistent, and give your work a signature style that works in any editor. Here's why they pay for themselves.",
    coverImage:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&q=80",
    author: "The Looks Lab",
    publishedAt: "2026-06-02T00:00:00Z",
    readingTime: 2,
    bodyHtml:
      "<p>You can grade every clip by hand — but LUTs save hours and make your work look unmistakably yours.</p><h2>Speed and consistency</h2><p>A LUT applies the same finished look to every clip instantly, so a whole project feels cohesive instead of mismatched.</p>",
  },
];

export const mockBlogPosts: BlogPostSummary[] = POSTS.map(
  ({ bodyHtml: _bodyHtml, ...summary }) => summary,
);

export function mockBlogPost(slug: string): BlogPost | null {
  return POSTS.find((p) => p.slug === slug) ?? null;
}
