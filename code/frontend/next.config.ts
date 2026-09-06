import type { NextConfig } from "next";

const API = process.env.API_ORIGIN || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API}/api/:path*` },
      { source: "/health", destination: `${API}/health` },
      { source: "/docs", destination: `${API}/docs` },
      { source: "/docs/:path*", destination: `${API}/docs/:path*` },
      { source: "/docs-json", destination: `${API}/docs-json` },
      { source: "/sample-catalogs/:path*", destination: `${API}/sample-catalogs/:path*` },
    ];
  },
};

export default nextConfig;
