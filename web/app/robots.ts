import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore", "/trends/", "/pricing", "/categories/", "/meta-trends/", "/sources/", "/social-intelligence", "/ad-intelligence"],
        disallow: ["/api/", "/admin/", "/settings/", "/login", "/signup", "/auth/"],
        crawlDelay: 10,
      },
      {
        userAgent: ["AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "BLEXBot", "PetalBot"],
        disallow: ["/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
