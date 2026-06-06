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
import { FAQ } from "@/components/FAQ";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/Reveal";

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
      <Hero />
      <LogoMarquee />

      {/* Featured LUTs */}
      <section className="container-xl py-24" id="featured">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Signature looks"
            title="Featured LUT packs"
            subtitle="Hand-built grades our community reaches for again and again."
          />
          <Reveal direction="left">
            <Link
              href="/collections/cinematic"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
            >
              View all looks <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
        <ProductGrid products={featured} />
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
            subtitle="Drag the handle to reveal what a single Looks Lab grade does to raw footage — richer contrast, filmic color, glowing skin."
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

      {/* How it works */}
      <section className="container-xl py-24" id="how">
        <SectionHeading
          eyebrow="Dead simple"
          title="How it works"
          subtitle="From checkout to graded footage in under two minutes."
          align="center"
        />
        <div className="mt-12">
          <HowItWorks />
        </div>
      </section>

      {/* FAQ */}
      <section className="container-xl py-12 pb-28" id="faq">
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
