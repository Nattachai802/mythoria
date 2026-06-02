import type { NextConfig } from "next";

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

export default nextConfig;
