import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Put <title>/<meta description> in the initial <head> for every client (no streamed metadata) — SEO + link previews.
  htmlLimitedBots: /.*/,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
