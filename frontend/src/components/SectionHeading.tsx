import type { ReactNode } from "react";
import { Reveal } from "./motion/Reveal";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <Reveal
      className={
        align === "center"
          ? "mx-auto max-w-2xl text-center"
          : "max-w-2xl text-left"
      }
    >
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl font-bold leading-tight tracking-tightest text-graphite sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg text-slate2">{subtitle}</p>}
    </Reveal>
  );
}
