import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Static export — simple, fast, FREE on Cloudflare Workers
  images: {
    unoptimized: true, // Required for static export
  },
  typescript: {
    // TODO: Remove once all pre-existing TS errors are fixed project-wide
    ignoreBuildErrors: true,
  },
  trailingSlash: true, // Better compatibility with static hosting
};

export default nextConfig;
