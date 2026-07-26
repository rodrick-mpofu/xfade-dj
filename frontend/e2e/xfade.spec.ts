/**
 * Browser-level tests — backlog §4.
 *
 * These exist because three of the four real bugs in this build were invisible to
 * the unit suites: missing table GRANTs, a CORS parse error that crashed the app at
 * startup while 115 tests passed, and a placeholder string that only looked wrong on
 * screen. All three needed something real to run.
 *
 * So nothing here is mocked. A real browser signs into a real Supabase, the frontend
 * calls a real backend, and Postgres enforces RLS. What is faked is only the audio:
 * feature rows are seeded, because extraction is the one part these tests do not
 * cover and running it would drag Essentia into CI.
 *
 * Serial by design — the tests share one seeded database and one of them writes.
 */

import { expect, test, type Page } from "@playwright/test";
import { OWNER, STRANGER, STRANGER_TRACK, TRACKS } from "./fixtures";

const [ALPHA, BRAVO] = TRACKS;

/**
 * Sidebar links, scoped to the navigation landmark.
 *
 * Unscoped, "Log a combo" also matches the dashboard's empty-state link. That is a
 * strict-mode violation rather than a wrong click, but only when the dashboard
 * happens to be empty — so it would have failed intermittently.
 */
function nav(page: Page, name: string) {
  return page.getByRole("navigation").getByRole("link", { name });
}

async function signIn(page: Page, account: typeof OWNER) {
  await page.goto("/");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The nav only renders once a session exists, so this is the sign-in assertion.
  await expect(nav(page, "Library")).toBeVisible();
}

/**
 * Fill the first open track picker and choose the single matching result.
 *
 * Always the first one: choosing a track collapses that picker into a "Change"
 * button, so calling this twice fills track A and then track B. Indexing the
 * pickers breaks as soon as the first one collapses.
 */
async function pickTrack(page: Page, title: string) {
  const search = page.locator('input[type="search"]').first();
  await search.waitFor({ state: "visible" });
  await search.fill(title);
  await page
    .getByRole("button", { name: new RegExp(escapeRegExp(title)) })
    .first()
    .click();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe.configure({ mode: "serial" });

test("signing in loads the library from the real API", async ({ page }) => {
  // The seam that matters: this request carries the browser's JWT to the backend,
  // which rebuilds a Supabase client from it so RLS decides what comes back. It is
  // also the exact path that returned 42501 for every row when the RLS policies
  // shipped without table GRANTs — a bug the entire unit suite passed straight
  // through, because nothing in it talked to Postgres.
  await signIn(page, OWNER);
  await nav(page, "Library").click();

  for (const track of TRACKS) {
    await expect(page.getByText(track.title)).toBeVisible();
  }
});

test("a compatibility score renders for a real pair", async ({ page }) => {
  await signIn(page, OWNER);
  await nav(page, "Log a combo").click();

  await pickTrack(page, ALPHA!.title);
  await pickTrack(page, BRAVO!.title);

  await expect(page.getByText("out of 100")).toBeVisible();

  // Deliberately not asserting the number. The weights in compatibility.py are
  // acknowledged heuristics that backlog §3 expects to be retuned; pinning 94 here
  // would turn every future tuning pass into a failing browser test. What must hold
  // is that a score computes and the reasoning reaches the screen.
  await expect(page.getByText(/^\d{1,3}$/).first()).toBeVisible();
  await expect(page.getByText("adjacent")).toBeVisible();
});

test("a logged combo survives a reload", async ({ page }) => {
  await signIn(page, OWNER);
  await nav(page, "Log a combo").click();

  await pickTrack(page, ALPHA!.title);
  await pickTrack(page, BRAVO!.title);
  await page.getByPlaceholder(/bass swap/).fill("e2e long blend");
  await page.getByRole("button", { name: "5 stars" }).click();
  await page.getByRole("button", { name: "Log combo" }).click();

  // The point of the reload. An optimistic cache update makes a write that never
  // reached Postgres look identical to one that did — which is why HANDOFF says to
  // reload and confirm rather than trust the screen.
  await page.goto("/combos");
  await page.reload();

  await expect(page.getByText("e2e long blend")).toBeVisible();
  await expect(page.getByText(ALPHA!.title).first()).toBeVisible();
});

test("a second user sees none of the owner's tracks", async ({ page }) => {
  // RLS is the authorization model, so this is the assertion that it is actually
  // switched on in the path the browser uses — not just in the backend's own tests,
  // which reach Postgres through a different client.
  await signIn(page, STRANGER);
  await nav(page, "Library").click();

  // Their own track first. Without this the test would pass just as happily against
  // a backend returning 500 for everything, since an empty page contains none of the
  // owner's titles either.
  await expect(page.getByText(STRANGER_TRACK.title)).toBeVisible();

  for (const track of TRACKS) {
    await expect(page.getByText(track.title)).toHaveCount(0);
  }
  await expect(page.getByText("e2e long blend")).toHaveCount(0);
});
