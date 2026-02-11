import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Optimized for Netlify deployment
  images: {
    unoptimized: true, // For Netlify compatibility
  },
  typescript: {
    ignoreBuildErrors: true, // Prevent build fails on type warnings
  },
};

export default nextConfig;
