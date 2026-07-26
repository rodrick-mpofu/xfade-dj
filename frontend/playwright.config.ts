import { defineConfig, devices } from "@playwright/test";

/**
 * The stack is started outside this config — `npx supabase start`, `docker compose
 * up -d`, `npm run dev` locally, and explicit steps in CI. Playwright's `webServer`
 * could boot the frontend, but not Supabase or the backend, so having it start one
 * of the three would only obscure which one is missing. `global-setup` checks all of
 * them and says which.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  // One seeded database, shared, and one test writes to it. Parallel workers would
  // make the RLS assertions race the combo that the write test logs.
  fullyParallel: false,
  workers: 1,

  // Nothing here is timing-dependent by design, so a retry would hide a real flake
  // rather than absorb one. CI gets a single retry only because a cold container can
  // lose the first request.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: process.env.XFADE_APP_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    colorScheme: "dark",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
