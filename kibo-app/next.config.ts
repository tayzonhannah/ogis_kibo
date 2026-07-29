import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The tank is a full-viewport surface and its controls sit along the bottom
  // edge, which is exactly where the dev indicator renders. Its portal
  // intercepts pointer events there, so the warmth button and memo input are
  // unclickable in dev. Compile and runtime errors are still surfaced.
  devIndicators: false,
};

export default nextConfig;
