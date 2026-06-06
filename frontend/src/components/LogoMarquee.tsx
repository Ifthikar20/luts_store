import { Marquee } from "./motion/Marquee";

// "Compatible with" app strip — text logos keep the bundle lean and avoid
// shipping third-party trademark assets.
const apps = [
  "DaVinci Resolve",
  "Premiere Pro",
  "Final Cut Pro",
  "LumaFusion",
  "Photoshop",
  "After Effects",
  "CapCut",
  "Lightroom",
];

export function LogoMarquee() {
  return (
    <div className="relative z-10 border-y border-white/5 bg-white/[0.015] py-8">
      <p className="container-xl mb-6 text-center text-xs font-semibold uppercase tracking-[0.25em] text-white/35">
        Drops straight into your editor
      </p>
      <Marquee>
        {apps.map((app) => (
          <span
            key={app}
            className="whitespace-nowrap font-display text-xl font-semibold text-white/30 transition-colors hover:text-white/70"
          >
            {app}
          </span>
        ))}
      </Marquee>
    </div>
  );
}
