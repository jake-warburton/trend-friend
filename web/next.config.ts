import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/explore",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=172800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/trends/:slug*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=172800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/categories/:slug*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=172800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/meta-trends/:slug*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=172800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/sources/:slug*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=172800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/social-intelligence",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=172800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/ad-intelligence",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=172800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=172800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
