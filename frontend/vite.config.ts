import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
// vitest/config, not vite: the plain defineConfig has no `test` key.
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The backend's CORS allowlist names this origin explicitly.
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    // Scoped to src on purpose. Vitest's default glob is repo-wide, so it also
    // collects e2e/*.spec.ts — and Playwright's `test` is a different API that
    // throws the moment vitest imports it. The two runners have to be kept apart:
    // `npm test` is vitest over src, `npm run test:e2e` is Playwright over e2e.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
