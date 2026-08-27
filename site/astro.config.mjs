// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";

import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://prgmr99.github.io",
  base: "/streaming-ssr-from-scratch",
  integrations: [react(), mdx()],
});
