import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore", "/trends/", "/pricing", "/categories/", "/meta-trends/", "/sources/", "/ai-use-cases", "/social-intelligence", "/ad-intelligence"],
        disallow: ["/api/", "/admin/", "/settings/", "/login", "/signup", "/auth/"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live"}/sitemap.xml`,
  };
}
