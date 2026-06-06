// Cinematic clip + poster config for the video-forward landing page.
//
// PLACEHOLDERS: these point at Google's public "gtv-videos-bucket" sample MP4s
// and Unsplash poster stills. They exist only so the video-forward UI is fully
// demoable without shipping real assets. SWAP THESE for real graded-clip
// previews (short, muted, looping before/after grades) before production.
//
// Every URL can be overridden at build time via NEXT_PUBLIC_* envs (handy for
// pointing at a CDN of real previews) — see resolveMedia() below.

const SAMPLE_BUCKET = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";

// The video host(s) referenced here MUST be allowed by the CSP `media-src`
// directive in next.config.mjs. Keep this list in sync with that file.
export const VIDEO_HOSTS = ["https://commondatastorage.googleapis.com"] as const;

export interface MediaClip {
  /** Stable id, used as a React key. */
  id: string;
  /** Short, human label shown on the card. */
  title: string;
  /** A "mood"/category subtitle. */
  mood: string;
  /** MP4 source — lazy-loaded (only attached when hovered/visible). */
  src: string;
  /** Poster still shown before/instead of the video (reduced-motion fallback). */
  poster: string;
}

// Reliable, long-lived sample clips from Google's public test bucket.
const CLIPS = {
  blazes: `${SAMPLE_BUCKET}/ForBiggerBlazes.mp4`,
  fun: `${SAMPLE_BUCKET}/ForBiggerFun.mp4`,
  joyrides: `${SAMPLE_BUCKET}/ForBiggerJoyrides.mp4`,
  escapes: `${SAMPLE_BUCKET}/ForBiggerEscapes.mp4`,
  meltdowns: `${SAMPLE_BUCKET}/ForBiggerMeltdowns.mp4`,
  elephants: `${SAMPLE_BUCKET}/ElephantsDream.mp4`,
} as const;

// Allow a single global override of the sample base, plus per-slot overrides.
function resolveMedia(envKey: string, fallback: string): string {
  const fromEnv = process.env[envKey as keyof NodeJS.ProcessEnv];
  return (typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : fallback) as string;
}

// The full-bleed hero background clip + its poster fallback.
export const HERO_VIDEO = {
  src: resolveMedia("NEXT_PUBLIC_HERO_VIDEO_URL", CLIPS.blazes),
  poster: resolveMedia(
    "NEXT_PUBLIC_HERO_POSTER_URL",
    "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1920&q=80",
  ),
} as const;

// "Looks in motion" bento grid — a gallery of graded clips in mixed sizes.
// `span` drives the CSS grid footprint (see the LooksInMotion section).
export interface BentoClip extends MediaClip {
  span: "wide" | "tall" | "normal" | "big";
}

export const BENTO_CLIPS: BentoClip[] = [
  {
    id: "nocturne",
    title: "Nocturne",
    mood: "Teal & orange night",
    span: "big",
    src: resolveMedia("NEXT_PUBLIC_CLIP_1_URL", CLIPS.joyrides),
    poster:
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "tropic",
    title: "Tropic",
    mood: "Warm golden hour",
    span: "tall",
    src: resolveMedia("NEXT_PUBLIC_CLIP_2_URL", CLIPS.fun),
    poster:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: "noir",
    title: "Midnight Noir",
    mood: "Crushed shadows",
    span: "normal",
    src: resolveMedia("NEXT_PUBLIC_CLIP_3_URL", CLIPS.escapes),
    poster:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: "ember",
    title: "Ember",
    mood: "Filmic skin tones",
    span: "wide",
    src: resolveMedia("NEXT_PUBLIC_CLIP_4_URL", CLIPS.meltdowns),
    poster:
      "https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "cascade",
    title: "Cascade",
    mood: "Cool cinematic blues",
    span: "normal",
    src: resolveMedia("NEXT_PUBLIC_CLIP_5_URL", CLIPS.elephants),
    poster:
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=80",
  },
];

// A pool of clips reused to give Featured LUT cards a hover-preview. The cards
// only have a poster image of their own; we pair each with a clip by index so
// the homepage stays purely presentational/demo. Real builds should attach a
// product's own preview clip.
export const PREVIEW_CLIP_POOL: string[] = [
  CLIPS.blazes,
  CLIPS.fun,
  CLIPS.joyrides,
  CLIPS.escapes,
  CLIPS.meltdowns,
  CLIPS.elephants,
];

export function previewClipFor(index: number): string {
  return PREVIEW_CLIP_POOL[index % PREVIEW_CLIP_POOL.length];
}
