/**
 * Capture the README screenshots against a running local stack.
 *
 * Committed rather than thrown away because screenshots go stale silently: after a
 * UI change, re-running this is the difference between a current front door and a
 * misleading one.
 *
 * Signs in with a magic link minted through the admin API, so no password is stored
 * here or typed anywhere. That only works against a local stack, which is the point
 * — it reads the service-role key from backend/.env and refuses to run against a
 * remote Supabase URL.
 *
 * Usage, with `npx supabase start`, `docker compose up -d` and `npm run dev` up:
 *   npm run screenshots
 */

import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OUT_DIR = resolve(REPO, "docs/images");

const APP_URL = process.env.XFADE_APP_URL ?? "http://localhost:5173";
const EMAIL = process.env.XFADE_EMAIL ?? "dj@example.com";

// Wide enough that the Library table does not wrap; 2x so the images stay sharp on
// a high-DPI screen without needing to be enormous.
const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2;

/** Minimal .env reader — avoids a dependency for four lines of parsing. */
async function readEnv(path) {
  const text = await readFile(path, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function magicLink(supabaseUrl, serviceKey) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email: EMAIL, redirect_to: APP_URL }),
  });
  if (!response.ok) {
    throw new Error(`generate_link failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()).action_link;
}

/**
 * Each shot names the route and what has to be on screen before the shutter goes.
 * Waiting on a selector rather than a timeout is what stops a screenshot catching a
 * loading spinner — the failure mode that makes automated captures worse than manual.
 */
const SHOTS = [
  {
    name: "library",
    path: "/library",
    ready: "table tbody tr:nth-child(6)",
  },
  {
    name: "combo-logger",
    path: "/log",
    ready: "text=out of 100",
    async prepare(page) {
      // Tinashe 11A/110 into Tory Lanez 10A/112 — adjacent keys, 1.8% apart, so the
      // panel shows a high score with real reasoning rather than an empty state.
      await pickTrack(page, "Tinashe");
      await pickTrack(page, "Tory Lanez");
    },
  },
  {
    name: "suggestions",
    path: "/suggestions",
    // Ranked results are links to each track; "out of 100" belongs to the combo
    // logger's score panel and never appears here.
    ready: 'a[href^="/tracks/"]',
    async prepare(page) {
      await pickTrack(page, "Tinashe");
    },
  },
  {
    name: "dashboard",
    path: "/",
    ready: "text=Best rated combos",
  },
];

/**
 * Fill the first open track picker and choose the single matching result.
 *
 * Always the *first* one on purpose: choosing a track collapses that picker into a
 * "Change" button, so on the combo logger calling this twice fills track A and then
 * track B. Indexing the pickers instead breaks the moment the first one collapses.
 */
async function pickTrack(page, query) {
  const search = page.locator('input[type="search"]').first();
  await search.waitFor({ state: "visible" });
  await search.fill(query);
  // The picker filters as you type; these queries match exactly one track, so the
  // first result is unambiguous.
  const result = page.locator("button", { hasText: query }).first();
  await result.waitFor({ state: "visible" });
  await result.click();
}

async function main() {
  const env = await readEnv(resolve(REPO, "backend/.env"));
  // backend/.env is written for the container, where the local stack is reachable
  // as host.docker.internal. This script runs on the host, where that name does not
  // resolve — so the same file works for both without a second copy of the keys.
  const supabaseUrl = (env.SUPABASE_URL ?? "").replace("host.docker.internal", "127.0.0.1");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("backend/.env needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|host\.docker\.internal)(:|\/|$)/.test(supabaseUrl)) {
    throw new Error(
      `Refusing to run against a non-local Supabase (${supabaseUrl}). ` +
        "This mints a sign-in link and is for the local stack only."
    );
  }

  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: "dark",
  });

  try {
    await page.goto(await magicLink(supabaseUrl, serviceKey));
    // The redirect lands on the app; the session is only usable once the shell
    // renders, which the nav proves.
    await page.waitForSelector("text=Suggestions", { timeout: 20_000 });

    for (const shot of SHOTS) {
      await page.goto(`${APP_URL}${shot.path}`);
      if (shot.prepare) await shot.prepare(page);
      await page.waitForSelector(shot.ready, { timeout: 20_000 });
      // Settles webfont swap and the score panel's transition, both of which show
      // up as a blurred or half-painted capture otherwise.
      await page.waitForTimeout(600);

      const file = resolve(OUT_DIR, `${shot.name}.png`);
      await page.screenshot({ path: file });
      console.log(`wrote ${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
