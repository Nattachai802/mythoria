import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable to reduce Radix UI hydration warnings
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "motion",
      "date-fns",
      "@xyflow/react",
      "fuse.js",
    ],
  },
  // NOTE: webpack file-watch polling was removed — Turbopack (default in dev)
  // ignores this key, and poll:1000 only slowed down the legacy `dev:webpack`
  // fallback. Re-add a `webpack: (config) => {...}` block here only if you
  // run `npm run dev:webpack` inside Docker/WSL where native file watching fails.
};

export default withSentryConfig(nextConfig, {
  // build ผ่านได้แม้ไม่มี SENTRY_AUTH_TOKEN — แต่จะไม่อัป source map แล้ว stack trace บน Sentry
  // จะเป็นชื่อย่อหลัง minify (rm, rf, 2_beqrdeq0c64.js) อ่านไม่ออก ต้องตั้ง token ใน env ของ Vercel
  org: "nattachai-6f",
  project: "mythoria",
  silent: true, // ไม่ต้อง log ระหว่าง build ให้รก
  widenClientFileUpload: true,
  // ส่ง event ผ่าน route ของเราเองแทนการยิงตรงไป *.ingest.sentry.io
  // ad blocker (uBlock/Brave/DNS filter) บล็อกโดเมนนั้นตรงๆ — ไม่มี tunnel = error ฝั่ง client
  // ของ user กลุ่มนั้นหายเงียบทั้งหมด ไม่ใช่แค่บางส่วน
  tunnelRoute: "/monitoring",
});
