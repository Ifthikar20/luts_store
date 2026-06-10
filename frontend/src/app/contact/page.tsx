import type { Metadata } from "next";
import Link from "next/link";
import { Clock, LifeBuoy, Mail } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { GradientBlob } from "@/components/motion/GradientBlob";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about a LUT pack, your download, or licensing? Get in touch with Luts.shop — we usually reply within one business day.",
  openGraph: {
    title: "Contact Luts.shop",
    description: "Get in touch with the studio — we usually reply within one business day.",
  },
};

export default function ContactPage() {
  return (
    <div className="relative overflow-hidden pb-28">
      <GradientBlob grade="teal-orange" className="-left-32 top-10" size={460} />
      <GradientBlob
        grade="violet-magenta"
        className="-right-40 top-72"
        size={420}
        delay={4}
      />

      <div className="container-xl relative pt-36 sm:pt-44">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate2">
              Get in touch
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tightest text-graphite sm:text-5xl">
              We&apos;d love to hear from you.
            </h1>
            <p className="mt-5 max-w-md text-lg text-slate2">
              Whether it&apos;s a question about a pack, a download issue, or a
              licensing query — drop us a note and we&apos;ll get back to you.
            </p>

            <ul className="mt-10 space-y-5">
              <li className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline bg-cloud text-sky">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-graphite">Email</p>
                  <a
                    href="mailto:support@luts.shop"
                    className="text-sm text-slate2 transition-colors hover:text-graphite"
                  >
                    support@luts.shop
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline bg-cloud text-sky">
                  <Clock className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-graphite">
                    Response time
                  </p>
                  <p className="text-sm text-slate2">
                    Usually within one business day.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline bg-cloud text-sky">
                  <LifeBuoy className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-graphite">
                    Need a quick answer?
                  </p>
                  <p className="text-sm text-slate2">
                    Browse the{" "}
                    <Link
                      href="/help"
                      className="text-sky underline-offset-4 hover:underline"
                    >
                      Help Center
                    </Link>{" "}
                    for install guides and FAQs.
                  </p>
                </div>
              </li>
            </ul>
          </Reveal>

          <Reveal direction="left">
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </div>
  );
}
