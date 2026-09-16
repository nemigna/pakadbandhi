import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { cloudApi } from "./scripts/dev-cloud.ts";
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudApi()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules\/(react|react-dom|scheduler)\//,
              priority: 20,
            },
            { name: "drag", test: /node_modules\/@dnd-kit\//, priority: 10 },
            { name: "validation", test: /node_modules\/zod\//, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
