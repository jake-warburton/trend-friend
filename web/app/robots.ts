import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore", "/trends/", "/pricing"],
        disallow: ["/api/", "/admin/", "/settings/", "/login", "/signup", "/auth/"],
      },
    ],
  };
}
