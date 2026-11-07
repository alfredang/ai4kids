import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next's standalone tracer doesn't auto-include the optional native
  // subpackages shipped alongside @anthropic-ai/claude-agent-sdk (the
  // linux-x64 / arm64 binary that powers the chatbot subprocess). Force
  // them in so the Docker image isn't missing the binary at runtime.
  outputFileTracingIncludes: {
    "/api/chat": ["./node_modules/@anthropic-ai/**/*"],
    "/api/ai/assist": ["./node_modules/@anthropic-ai/**/*"],
  },
  images: {
    qualities: [75, 90],
    remotePatterns: [
      { protocol: "https", hostname: "www.tertiaryinfotech.com" },
      // Cloudflare R2 public buckets (logo, uploaded media).
      { protocol: "https", hostname: "*.r2.dev" },
      // R2 custom domain / S3 endpoint.
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
  async redirects() {
    // Dynamic redirects (from `redirects` DB table) are handled in middleware.
    // Everything else lands on app/not-found.tsx.
    const home = (source: string, destination = "/") => ({ source, destination, permanent: true });
    return [
      // Addresses a parent is likely to type or trim down to.
      home("/workshops", "/holiday-workshops"),
      home("/book", "/programs"),
      home("/courses", "/programs"),
      home("/services", "/programs"),
      home("/about", "/contact"),
      // Corporate URLs inherited from the CMS this site was cloned from. Kids'
      // courses are not funded, so none of these pages exist here.
      ...[
        "/ssg-ato-application",
        "/tpqa-consultancy",
        "/wsq-course-development",
        "/learning-management-system",
        "/training-management-system",
        "/hr-management-system",
        "/content-management-system",
        "/ai-solutions",
        "/ai-agent-deployment",
        "/ai-chatbot-portfolio",
        "/real-clients",
        "/edtools",
      ].map((source) => home(source)),
    ];
  },
};

export default nextConfig;
