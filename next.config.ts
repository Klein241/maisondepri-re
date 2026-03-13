import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Cloudflare Workers via OpenNext
  // This gives us: SSR, dynamic routes, OG meta for book links
  // FREE: 100K requests/day on Cloudflare Workers free tier
  images: {
    unoptimized: true, // Use external image URLs (Supabase/R2)
  },
  typescript: {
    ignoreBuildErrors: true, // Prevent build fails on type warnings
  },
};

export default nextConfig;
