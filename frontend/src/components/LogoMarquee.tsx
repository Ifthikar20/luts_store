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
    <div className="relative z-10 border-y border-hairline bg-paper py-8">
      <p className="container-xl mb-6 text-center text-xs font-semibold uppercase tracking-[0.25em] text-slate2">
        Drops straight into your editor
      </p>
      <Marquee>
        {apps.map((app) => (
          <span
            key={app}
            className="whitespace-nowrap font-display text-xl font-semibold text-[#aeaeb2] transition-colors hover:text-graphite"
          >
            {app}
          </span>
        ))}
      </Marquee>
    </div>
  );
}
