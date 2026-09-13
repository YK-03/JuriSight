import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,

  serverExternalPackages: ["tesseract.js"],

  async redirects() {
    return [
      {
        source: "/demo",
        destination: "/guest",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;