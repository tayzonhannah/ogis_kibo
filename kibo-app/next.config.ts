import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The tank is a full-viewport surface and its controls sit along the bottom
  // edge, which is exactly where the dev indicator renders. Its portal
  // intercepts pointer events there, so the warmth button and memo input are
  // unclickable in dev. Compile and runtime errors are still surfaced.
  devIndicators: false,

  async headers() {
    return [
      {
        // A cached service worker is a service worker you cannot fix. The
        // browser revalidates sw.js on its own schedule, and without this a CDN
        // can keep serving an old one long after a deploy.
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
