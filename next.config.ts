import type { NextConfig } from "next";

// `GITHUB_PAGES=true` produces a fully static export under a sub-path (see .github/workflows/pages.yml).
// Normal builds (including the preview runtime) are left untouched so /api/health keeps working.
const pages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = pages
  ? {
      output: "export",
      trailingSlash: true,
      basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
