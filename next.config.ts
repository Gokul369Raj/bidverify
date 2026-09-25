import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    /* Full-bleed heroes need to go well past 1200px or the browser upscales a
       smaller file and the photograph looks soft. These cover a 1280px viewport
       at DPR 2 and a 2560px desktop at DPR 1. */
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920, 2048, 2560],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    /* Next 15.4+ restricts `quality` to this list — 90 is used for the hero. */
    qualities: [75, 82, 90],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
