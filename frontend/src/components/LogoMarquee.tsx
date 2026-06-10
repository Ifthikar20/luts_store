// "Drops straight into your editor" — a simple, static strip of the apps the
// LUTs drop into. Text logos keep the bundle lean and avoid shipping
// third-party trademark assets.
import { Reveal } from "./motion/Reveal";

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
    <div className="border-y border-hairline bg-paper py-14">
      <Reveal className="container-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate2">
          Works on all apps
        </p>
        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {apps.map((app) => (
            <span
              key={app}
              className="whitespace-nowrap font-display text-lg font-medium text-slate2 transition-colors hover:text-graphite"
            >
              {app}
            </span>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
