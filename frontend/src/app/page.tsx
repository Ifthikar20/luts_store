import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCollections, getProducts } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { LogoMarquee } from "@/components/LogoMarquee";
import { SectionHeading } from "@/components/SectionHeading";
import { ProductGrid } from "@/components/ProductGrid";
import { CategoryCard } from "@/components/CategoryCard";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { BundleCard } from "@/components/BundleCard";
import { HowItWorks } from "@/components/HowItWorks";
import { LooksInMotion } from "@/components/LooksInMotion";
import { FAQ } from "@/components/FAQ";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  description:
    "Premium cinematic LUTs for filmmakers and editors — color grade in one drag.",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default async function HomePage() {
  const [featured, collections, bundleList] = await Promise.all([
    getProducts({ featured: true }),
    getCollections(),
    getProducts({ collection: "bundles" }),
  ]);

  const bundle = bundleList[0] ?? null;
  // Categories section excludes the bundles collection (it has its own block).
  const categories = collections.filter((c) => c.handle !== "bundles");

  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={websiteJsonLd} />
      <Hero />
      <LogoMarquee />

      {/* Looks in motion — video bento grid on a light-gray band */}
      <section className="bg-cloud py-24" id="looks-in-motion">
        <div className="container-xl">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              eyebrow="Watch the grade"
              title="Looks in motion."
              subtitle="Real cinematic grades, applied to motion — not just stills. Each clip plays automatically as it scrolls into view."
            />
            <Reveal direction="left">
              <Link
                href="/collections/cinematic"
                className="inline-flex items-center gap-2 text-sm font-semibold text-sky transition-colors hover:text-sky-hover"
              >
                Explore the looks <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
          <LooksInMotion />
        </div>
      </section>

      {/* Featured LUTs */}
      <section className="container-xl py-24" id="featured">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Signature looks"
            title="Featured LUT packs"
            subtitle="Hand-built grades our community reaches for again and again. Hover a card to preview the look in motion."
          />
          <Reveal direction="left">
            <Link
              href="/collections/cinematic"
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky transition-colors hover:text-sky-hover"
            >
              View all looks <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
        <ProductGrid products={featured} withVideoPreview />
      </section>

      {/* Categories */}
      <section className="container-xl py-12" id="categories">
        <SectionHeading
          eyebrow="Browse by mood"
          title="Find your grade"
          align="center"
        />
        <StaggerGroup className="mt-12 grid gap-6 md:grid-cols-3">
          {categories.map((c) => (
            <StaggerItem key={c.handle} className="h-full">
              <CategoryCard collection={c} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* Before / After */}
      <section className="container-xl py-24" id="before-after">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <SectionHeading
            eyebrow="See the difference"
            title={
              <>
                One LUT. <span className="text-grade-teal">Instant cinema.</span>
              </>
            }
            subtitle="Drag the handle to reveal what a single Luts.store grade does to raw footage — richer contrast, filmic color, glowing skin."
          />
          <Reveal direction="left">
            <BeforeAfterSlider
              image="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1400&q=80"
              alt="Cinematic city scene"
            />
          </Reveal>
        </div>
      </section>

      {/* Bundle highlight */}
      {bundle && (
        <section className="container-xl py-12" id="bundles">
          <SectionHeading
            eyebrow="Maximum value"
            title="Get every look"
            align="center"
          />
          <Reveal className="mt-12">
            <BundleCard bundle={bundle} />
          </Reveal>
        </section>
      )}

      {/* How it works — on a light-gray band */}
      <section className="bg-cloud py-24" id="how">
        <div className="container-xl">
          <SectionHeading
            eyebrow="Dead simple"
            title="How it works"
            subtitle="From checkout to graded footage in under two minutes."
            align="center"
          />
          <div className="mt-12">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-xl py-12" id="faq">
        <SectionHeading
          eyebrow="Good to know"
          title="Frequently asked"
          align="center"
        />
        <div className="mt-12">
          <FAQ />
        </div>
      </section>
    </>
  );
}
