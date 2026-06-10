import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { GradientBlob } from "@/components/motion/GradientBlob";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "Luts.store is a color-grading studio crafting cinematic LUTs for filmmakers, editors and creators. Learn the story behind our looks.",
  openGraph: {
    title: "About Luts.store",
    description:
      "A color-grading studio crafting cinematic LUTs for filmmakers and editors.",
  },
};

const values = [
  {
    title: "Built on real footage",
    body: "Every LUT is graded and stress-tested against real-world footage — skin tones, skies, neon, shadow detail — not just a single hero shot.",
  },
  {
    title: "One drag, no fuss",
    body: "We obsess over looks that drop in cleanly and dial to taste. No plugins, no subscriptions, no learning curve — just color.",
  },
  {
    title: "Made for every editor",
    body: "Standard .cube and .3dl files work in DaVinci Resolve, Premiere Pro, Final Cut, CapCut, Photoshop and more. Buy once, own forever.",
  },
];

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden pb-28">
      <GradientBlob grade="teal-orange" className="-left-32 top-10" size={500} />
      <GradientBlob
        grade="violet-magenta"
        className="-right-40 top-72"
        size={460}
        delay={4}
      />

      <div className="container-xl relative pt-36 sm:pt-44">
        <Reveal>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate2">
            Our story
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight tracking-tightest text-graphite sm:text-6xl">
            Cinematic color, made approachable.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate2">
            Luts.store started with a simple frustration: great color grades
            felt locked behind years of practice and expensive suites. We set
            out to bottle that craft into LUTs anyone can drop onto their
            timeline and get a filmic result in seconds.
          </p>
        </Reveal>
      </div>

      <section className="container-xl relative mt-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="glass rounded-3xl p-8">
              <h2 className="font-display text-2xl font-semibold text-graphite">
                A studio, not a marketplace
              </h2>
              <p className="mt-4 text-slate2">
                We are a small team of colorists and filmmakers. Each pack is
                hand-built in our grading suite, reviewed across cameras and
                lighting conditions, and refined until it holds up on real
                projects — weddings, music videos, commercials, short films and
                everything in between.
              </p>
              <p className="mt-4 text-slate2">
                Because we make every look ourselves, we can stand behind it. If
                a file ever misbehaves, we fix it. When we improve a pack, you
                get the update free.
              </p>
            </div>
          </Reveal>
          <Reveal direction="left">
            <div className="glass rounded-3xl p-8">
              <h2 className="font-display text-2xl font-semibold text-graphite">
                What we believe
              </h2>
              <p className="mt-4 text-slate2">
                Color is storytelling. The right grade sets mood, guides the
                eye, and makes footage feel intentional. Our job is to give you
                that emotional shorthand without the technical overhead — so you
                can spend your energy on the story, not the scopes.
              </p>
              <p className="mt-4 text-slate2">
                We price honestly, deliver instantly, and never lock your work
                behind a watermark or a renewal.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container-xl relative mt-24">
        <SectionHeading
          eyebrow="How we work"
          title="What every pack stands for"
          align="center"
        />
        <StaggerGroup className="mt-12 grid gap-6 md:grid-cols-3">
          {values.map((v) => (
            <StaggerItem key={v.title} className="h-full">
              <div className="glass h-full rounded-3xl p-7">
                <h3 className="font-display text-lg font-semibold text-graphite">
                  {v.title}
                </h3>
                <p className="mt-3 text-sm text-slate2">{v.body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="container-xl relative mt-24">
        <Reveal className="glass flex flex-col items-center gap-6 rounded-3xl px-8 py-16 text-center">
          <h2 className="max-w-xl font-display text-3xl font-bold tracking-tightest text-graphite">
            Ready to grade your next project?
          </h2>
          <p className="max-w-md text-slate2">
            Browse the full library of cinematic looks or reach out — we love
            hearing what you&apos;re making.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/collections/cinematic" className="btn-grade">
              Explore looks <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="text-sm font-semibold text-slate2 transition-colors hover:text-graphite"
            >
              Contact us
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
