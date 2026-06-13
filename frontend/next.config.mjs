/** @type {import('next').NextConfig} */

// Derive the API origin so the CSP can allow XHR/fetch to the Django BFF.
// Only NEXT_PUBLIC_ envs are available here at build time; never put secrets in this file.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
let apiOrigin = "http://localhost:8000";
try {
  apiOrigin = new URL(API_URL).origin;
} catch {
  // keep default
}

// Hosts that serve the landing-page preview clips. Keep in sync with
// src/lib/media.ts (VIDEO_HOSTS). Overridable so a deploy can point media-src at
// its own video CDN. These are PLACEHOLDER sample clips — swap for real grades.
const VIDEO_HOSTS = (
  process.env.NEXT_PUBLIC_VIDEO_HOSTS ||
  "https://commondatastorage.googleapis.com"
)
  .split(/[ ,]+/)
  .filter(Boolean);

// CDN origin for uploaded preview media (CloudFront). When set, optimised
// images + adaptive-HLS video are served from here, so it must be allowed for
// images, <video>/HLS media, AND connect-src (hls.js fetches .m3u8/.ts segments
// over fetch/XHR — without this the player is silently CSP-blocked). The S3
// presigned fallback (when no CDN) is covered by the amazonaws.com source.
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || "";
let cdnOrigin = "";
try {
  cdnOrigin = CDN_URL ? new URL(CDN_URL).origin : "";
} catch {
  // keep empty
}
// Sources for media that may come from the CDN or directly from S3 (presigned).
const mediaSources = [cdnOrigin, "https://*.amazonaws.com"]
  .filter(Boolean)
  .join(" ");

// Google reCAPTCHA v3 hosts — only added to the CSP when a site key is set, so
// the policy stays tight when the bot check is disabled. reCAPTCHA loads a
// script from google/gstatic, may open a challenge iframe (google), and phones
// home over fetch (google).
const RECAPTCHA_ON = !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const RECAPTCHA_SCRIPT = RECAPTCHA_ON
  ? " https://www.google.com https://www.gstatic.com"
  : "";
const RECAPTCHA_FRAME = RECAPTCHA_ON ? " https://www.google.com" : "";
const RECAPTCHA_CONNECT = RECAPTCHA_ON ? " https://www.google.com" : "";

// In production we drop 'unsafe-eval' — the built Next bundle doesn't need it
// (it's only used by the dev HMR/react-refresh runtime). 'unsafe-inline' for
// scripts stays because Next injects unnonced inline bootstrap scripts.
const isProd = process.env.NODE_ENV === "production";
const scriptSrc =
  (isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'") + RECAPTCHA_SCRIPT;

// A reasonable Content-Security-Policy:
// - next/font (Google) is self-hosted at build time, so no font CDN is needed.
// - 'unsafe-inline' for styles is required by Next's runtime style injection + Framer Motion.
// - images allowed from self, data URIs, blob, Unsplash placeholders, and the CDN/S3.
// - media-src allows self, blob:, the sample video host(s), and the CDN/S3 (HLS).
// - connect-src allows the API origin (BFF calls) and the CDN/S3 (hls.js fetches).
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  `frame-src 'self'${RECAPTCHA_FRAME}`,
  "object-src 'none'",
  `img-src 'self' data: blob: https://images.unsplash.com ${mediaSources}`,
  `media-src 'self' blob: ${VIDEO_HOSTS.join(" ")} ${mediaSources}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  `connect-src 'self' ${apiOrigin} ${mediaSources}${RECAPTCHA_CONNECT}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runner stage can ship a minimal image (see frontend/Dockerfile).
  output: "standalone",
  images: {
    // Hosts next/image is allowed to optimise: Unsplash placeholders, plus the
    // CDN origin (uploaded product images) when configured.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...(cdnOrigin
        ? [
            {
              protocol: "https",
              hostname: new URL(cdnOrigin).hostname,
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
