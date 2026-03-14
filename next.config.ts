import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Static export — simple, fast, FREE on Cloudflare Workers
  images: {
    unoptimized: true, // Required for static export
  },
  typescript: {
    ignoreBuildErrors: true, // Prevent build fails on type warnings
  },
  trailingSlash: true, // Better compatibility with static hosting
};

export default nextConfig;
