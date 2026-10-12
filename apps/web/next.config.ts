import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Proof generation and on-chain confirmation can take a while; keep the /api proxy open.
  experimental: { proxyTimeout: 180_000 },
  // The browser only ever talks to same-origin /api/*, so the session cookie is
  // first-party and there is no CORS to configure. The FastAPI app serves its
  // routes without the /api prefix.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
