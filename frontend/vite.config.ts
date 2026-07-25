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
  },
});
