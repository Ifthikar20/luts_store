import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getProducts } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { LogoMarquee } from "@/components/LogoMarquee";
import { SectionHeading } from "@/components/SectionHeading";
import { ProductGrid } from "@/components/ProductGrid";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { BundleCard } from "@/components/BundleCard";
import { HowItWorks } from "@/components/HowItWorks";
import { LooksInMotion } from "@/components/LooksInMotion";
import { FAQ } from "@/components/FAQ";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

// Before/after examples by camera source (the "See the difference" section).
const beforeAfterExamples = [
  {
    label: "DJI Osmo Pocket 3",
    alt: "Aerial drone landscape",
    image:
      "https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=1400&q=80",
  },
  {
    label: "iPhone",
    alt: "Street portrait shot on phone",
    image:
      "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=1400&q=80",
  },
  {
    label: "Mirrorless",
    alt: "Cinematic city scene",
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1400&q=80",
  },
];

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
  const [featured, bundleList] = await Promise.all([
    getProducts({ featured: true }),
    getProducts({ collection: "bundles" }),
  ]);

  const bundle = bundleList[0] ?? null;

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
              titleClassName="text-shine inline-block pb-1 font-display text-3xl font-bold leading-tight tracking-tightest sm:text-4xl md:text-5xl"
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

      {/* Before / After — moved up; multiple camera examples */}
      <section className="container-xl py-24" id="before-after">
        <SectionHeading
          eyebrow="See the difference"
          title={
            <>
              One LUT. <span className="text-grade-teal">Instant cinema.</span>
            </>
          }
          subtitle="Drag the handle to reveal what a single Luts.store grade does to raw footage from DJI Osmo, iPhone and mirrorless cameras — richer contrast, filmic color, glowing skin."
          align="center"
        />
        {/* Featured large comparison + two supporting examples below. */}
        <Reveal className="mx-auto mt-12 max-w-5xl">
          <BeforeAfterSlider
            image={beforeAfterExamples[0].image}
            alt={beforeAfterExamples[0].alt}
            label={beforeAfterExamples[0].label}
          />
        </Reveal>
        <StaggerGroup className="mx-auto mt-6 grid max-w-5xl gap-6 sm:grid-cols-2">
          {beforeAfterExamples.slice(1).map((ex) => (
            <StaggerItem key={ex.label}>
              <BeforeAfterSlider image={ex.image} alt={ex.alt} label={ex.label} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* Featured LUTs */}
      <section className="container-xl py-24" id="featured">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Signature looks"
            title="Featured LUT packs"
            subtitle="Hand-built grades our community reaches for again and again. Hover a card to preview the look in motion."
            titleClassName="font-serif text-4xl font-normal leading-[1.05] tracking-tight text-graphite sm:text-5xl md:text-6xl"
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
        <ProductGrid products={featured.slice(0, 3)} withVideoPreview />
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
