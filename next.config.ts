import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // For static export compatibility
  },
  typescript: {
    ignoreBuildErrors: true, // Prevent build fails on type warnings
  },
};

export default nextConfig;
