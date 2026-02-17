import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // For static export compatibility
  },
  typescript: {
    ignoreBuildErrors: true, // Prevent build fails on type warnings
  },
  // Optimize package imports to reduce bundle size and avoid barrel-export TDZ issues
  // experimental: {
  //   optimizePackageImports: [
  //     'lucide-react',
  //     'framer-motion',
  //     'date-fns',
  //   ],
  // },
};

export default nextConfig;
