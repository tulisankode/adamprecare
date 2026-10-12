import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a production build run next to a running dev server without clobbering its .next folder
  // (e.g. NEXT_DIST_DIR=.next-build npx next build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Photos / ambulance images come from signed API URLs; plain <img> is used for them.
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
