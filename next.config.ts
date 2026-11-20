import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Next bakes rewrites into .next at BUILD time, so NODE_ENV (production builds) must enable them too;
    // otherwise `npm run build` on Render without PROXY_API produces a site whose /api/* returns 404.
    const enabled = process.env.PROXY_API === "1" || process.env.NODE_ENV === "production";
    return enabled ? [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:8000"}/:path*` }] : [];
  },

  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
