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

// A reasonable Content-Security-Policy:
// - next/font (Google) is self-hosted at build time, so no font CDN is needed.
// - 'unsafe-inline' for styles is required by Next's runtime style injection + Framer Motion.
// - script 'unsafe-inline'/'unsafe-eval' kept loose for Next dev/runtime; tighten with nonces in a hardened deploy.
// - images allowed from self, data URIs, blob, and images.unsplash.com (placeholder photos).
// - connect-src allows the API origin so the storefront can call the BFF.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https://images.unsplash.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  `connect-src 'self' ${apiOrigin}`,
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
  images: {
    // Only allow Unsplash placeholder photos through next/image.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
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
