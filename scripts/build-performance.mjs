import { build } from "rolldown";
await build({
  input: "tests/performance-entry.ts",
  output: {
    file: "output/playwright/performance.js",
    format: "iife",
    name: "PakadbandiBenchmark",
    minify: true,
  },
});
