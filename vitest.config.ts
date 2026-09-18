import { defineConfig } from "vitest/config";
import path from "path";

// Server-side unit tests only (lib/, api routes) — no jsdom/browser env
// needed anywhere yet, so this stays the plain Node environment default.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
