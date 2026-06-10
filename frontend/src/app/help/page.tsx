import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { FAQ } from "@/components/FAQ";
import type { FaqItem } from "@/components/FAQ";
import { GradientBlob } from "@/components/motion/GradientBlob";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Install LUTs in Premiere, DaVinci Resolve, Final Cut and CapCut, learn about file formats, downloads and refunds. Everything you need from Luts.shop.",
  openGraph: {
    title: "Help Center | Luts.shop",
    description:
      "Install guides, file formats, downloads and refunds — all in one place.",
  },
};

const categories: { title: string; eyebrow: string; items: FaqItem[] }[] = [
  {
    eyebrow: "Installing",
    title: "Installing your LUTs",
    items: [
      {
        q: "How do I install a LUT in Adobe Premiere Pro?",
        a: "Add an adjustment layer (or select your clip), open the Lumetri Color panel, expand Creative, and under “Look” choose Browse. Point it at the .cube file from your pack, then dial the Intensity slider to taste.",
      },
      {
        q: "How do I install a LUT in DaVinci Resolve?",
        a: "Copy the .cube files into Resolve’s LUT folder (Project Settings → Color Management → Open LUT Folder), click Update Lists, then right-click any clip in the Color page and pick the LUT from the 3D LUT menu — or drag it onto a node.",
      },
      {
        q: "How do I install a LUT in Final Cut Pro?",
        a: "Select your clip, add the “Custom LUT” effect from the Effects browser, then in the inspector choose “Add Custom LUT…” and import the .cube file. Adjust the Mix slider to control strength.",
      },
      {
        q: "How do I install a LUT in CapCut?",
        a: "On desktop CapCut, select your clip, open Adjustment → LUT → Import, and choose the .cube file. On mobile, LUT import support varies by version — desktop is recommended for full .cube support.",
      },
    ],
  },
  {
    eyebrow: "Files & compatibility",
    title: "File formats & compatibility",
    items: [
      {
        q: "What file formats are included?",
        a: "Every pack ships standard .cube files, and where noted also .3dl. These are industry-standard 3D LUTs that load in virtually any modern editor or color tool.",
      },
      {
        q: "Will these work with log or raw footage?",
        a: "Our cinematic looks are built for Rec.709 by default. If you’re shooting log, apply your camera’s log-to-Rec.709 conversion first, then layer the LUT on top. Bundles include a Rec.709 set so you can grade straight out of camera.",
      },
      {
        q: "Do LUTs work on photos too?",
        a: "Yes — you can load .cube files into Photoshop (Color Lookup adjustment layer) and Lightroom (as profiles, via conversion) for a consistent look across photo and video.",
      },
    ],
  },
  {
    eyebrow: "Downloads & account",
    title: "Downloads & redownloads",
    items: [
      {
        q: "Where do I download my LUTs after purchase?",
        a: "You’ll get an instant download link on the confirmation page and by email. You can also access every pack you’ve bought anytime from your account library.",
      },
      {
        q: "Can I redownload a pack later?",
        a: "Absolutely. Sign in and visit your account to redownload any purchase. Lost the email? Use “Resend my links” on the account page to have your most recent order’s links sent again.",
      },
      {
        q: "How long are download links valid?",
        a: "Direct links are time-limited for security, but your purchases never expire — just sign in to your library to generate a fresh download whenever you need one.",
      },
    ],
  },
  {
    eyebrow: "Billing",
    title: "Refunds & billing",
    items: [
      {
        q: "What is your refund policy?",
        a: "Because LUTs are instantly delivered digital goods, sales are generally final. If a file is corrupt or won’t load, contact us and we’ll fix it or make it right. See our Refund Policy for full details.",
      },
      {
        q: "Do I need a subscription?",
        a: "No. Every pack is a one-time purchase — buy once, own forever, including free updates to that pack.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="relative overflow-hidden pb-28">
      <GradientBlob grade="teal-orange" className="-left-32 top-10" size={480} />
      <GradientBlob
        grade="violet-magenta"
        className="-right-40 top-80"
        size={440}
        delay={4}
      />

      <div className="container-xl relative pt-36 sm:pt-44">
        <Reveal>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate2">
            Help Center
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight tracking-tightest text-graphite sm:text-6xl">
            How can we help?
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate2">
            Install guides, file formats, downloads and refunds. Can&apos;t find
            what you need? Manage purchases in your{" "}
            <Link
              href="/account"
              className="text-sky underline-offset-4 hover:underline"
            >
              account library
            </Link>{" "}
            or{" "}
            <Link
              href="/contact"
              className="text-sky underline-offset-4 hover:underline"
            >
              contact us
            </Link>
            .
          </p>
        </Reveal>
      </div>

      {categories.map((cat) => (
        <section key={cat.title} className="container-xl relative mt-20">
          <SectionHeading eyebrow={cat.eyebrow} title={cat.title} />
          <div className="mt-8">
            <FAQ items={cat.items} />
          </div>
        </section>
      ))}
    </div>
  );
}
