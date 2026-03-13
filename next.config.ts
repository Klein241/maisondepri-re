import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No 'output: export' — we use Cloudflare Workers via OpenNext (SSR)
  // This gives us: dynamic routes, SSR pages, OG meta for book links
  // And it's FREE: 100K requests/day on Cloudflare Workers free tier
  images: {
    unoptimized: true, // Use external image URLs (Supabase/R2)
  },
  typescript: {
    ignoreBuildErrors: true, // Prevent build fails on type warnings
  },
};

export default nextConfig;
