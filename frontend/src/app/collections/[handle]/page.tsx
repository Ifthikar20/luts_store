import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { getCollection, getCollections, getFacets } from "@/lib/api";
import { DiscoveryView } from "@/components/DiscoveryView";
import { GradientBlob } from "@/components/motion/GradientBlob";
import { Reveal } from "@/components/motion/Reveal";

export async function generateStaticParams() {
  const collections = await getCollections();
  return collections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const collection = await getCollection(handle);
  if (!collection) return { title: "Collection not found" };
  // CollectionWithProducts has no image field; fall back to the first product's
  // featured image for the social card when available.
  const ogImage = collection.products[0]?.featuredImage.url;
  return {
    title: collection.title,
    description: collection.description,
    openGraph: {
      title: collection.title,
      description: collection.description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const collection = await getCollection(handle);
  if (!collection) notFound();

  // Facets scoped to this collection, computed server-side for the initial
  // render so the filter UI is populated without a client round-trip.
  const facets = await getFacets(handle);

  return (
    <div className="relative overflow-hidden">
      <GradientBlob grade="teal-orange" className="-left-32 top-10" size={500} />
      <GradientBlob
        grade="violet-magenta"
        className="-right-40 top-64"
        size={460}
        delay={4}
      />

      <div className="container-xl relative pt-36 sm:pt-44">
        <Reveal>
          <nav className="mb-6 flex items-center gap-1.5 text-sm text-white/45">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-white/70">{collection.title}</span>
          </nav>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">
            {collection.title}
          </h1>
          {collection.description && (
            <p className="mt-5 max-w-2xl text-lg text-white/55">
              {collection.description}
            </p>
          )}
          <p className="mt-4 text-sm text-white/40">
            {collection.products.length} pack
            {collection.products.length === 1 ? "" : "s"}
          </p>
        </Reveal>
      </div>

      <div className="container-xl relative py-16">
        {/* SSG/ISR renders the initial product list + facets; DiscoveryView
            then allows client-side refine. It reads useSearchParams, so it is
            wrapped in <Suspense> for the App Router build. */}
        <Suspense
          fallback={
            <div className="glass rounded-3xl px-8 py-16 text-center text-white/50">
              Loading…
            </div>
          }
        >
          <DiscoveryView
            collection={handle}
            initialProducts={collection.products}
            initialFacets={facets}
            emptyMessage="No packs match your filters — try widening them."
          />
        </Suspense>
      </div>
    </div>
  );
}
