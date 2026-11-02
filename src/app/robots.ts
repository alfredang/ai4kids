import type { MetadataRoute } from "next";

const BASE = "https://ai4kids.tertiarycourses.com.sg";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/learn", "/parent", "/dashboard", "/login"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
