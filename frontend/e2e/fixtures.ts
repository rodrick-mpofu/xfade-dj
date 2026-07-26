/**
 * Fixture data for the browser tests, created through the admin API and PostgREST
 * with the service-role key.
 *
 * Seeded rather than uploaded: none of these tests exercise extraction, so they need
 * feature rows but not audio. That keeps the suite off Essentia entirely, which is
 * what lets CI run the backend natively instead of building the 1 GB image.
 *
 * Two users, because RLS isolation is one of the things being tested and it cannot
 * be observed with one. Deleting a user cascades to their tracks, features and
 * combos, so teardown is a single call per user.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");

/** Throwaway accounts in a local, ephemeral database — recreated on every run. */
export const OWNER = { email: "e2e-owner@xfade.test", password: "e2e-owner-pw-8241" };
export const STRANGER = { email: "e2e-stranger@xfade.test", password: "e2e-stranger-pw-3907" };

/**
 * Titles are distinctive so a locator cannot accidentally match real data if this
 * ever runs against a developer's own stack.
 *
 * Alpha into Bravo is adjacent on the wheel and 1.8% apart in tempo — a deliberately
 * strong pair, so the compatibility panel has something definite to render.
 */
export const TRACKS = [
  { title: "E2E Fixture Alpha", artist: "Fixture", key: "11A", bpm: 110, energy: 0.61 },
  { title: "E2E Fixture Bravo", artist: "Fixture", key: "10A", bpm: 112, energy: 0.37 },
  { title: "E2E Fixture Charlie", artist: "Fixture", key: "5A", bpm: 128, energy: 0.88 },
];

/**
 * The stranger gets a library of their own, and this is load-bearing.
 *
 * Asserting only that they cannot see the owner's tracks would pass just as happily
 * if the API were returning 500 for everything — an empty page satisfies "none of
 * these are present". Requiring them to see their own track distinguishes RLS
 * working from the whole stack being down.
 */
export const STRANGER_TRACK = {
  title: "E2E Stranger Only",
  artist: "Fixture",
  key: "3B",
  bpm: 124,
  energy: 0.44,
};

async function readEnvFile(path: string): Promise<Record<string, string>> {
  try {
    const text = await readFile(path, "utf8");
    const out: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match?.[1]) out[match[1]] = (match[2] ?? "").replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    // CI passes these as environment variables and has no backend/.env.
    return {};
  }
}

export async function config() {
  const file = await readEnvFile(resolve(REPO, "backend/.env"));
  // host.docker.internal is how the container reaches the local stack; this runs on
  // the host, where that name does not resolve.
  const supabaseUrl = (process.env.SUPABASE_URL ?? file.SUPABASE_URL ?? "").replace(
    "host.docker.internal",
    "127.0.0.1",
  );
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? file.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, from the environment or backend/.env.",
    );
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl)) {
    throw new Error(
      `Refusing to seed a non-local Supabase (${supabaseUrl}). These tests create and ` +
        "delete users and would happily do it to a real project.",
    );
  }
  return { supabaseUrl, serviceKey };
}

function headers(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

async function call(url: string, serviceKey: string, init: RequestInit = {}) {
  // Merged, not replaced: callers add headers like PostgREST's `Prefer`, and
  // overwriting the object here silently dropped them.
  const response = await fetch(url, {
    ...init,
    headers: { ...headers(serviceKey), ...(init.headers as Record<string, string>) },
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} -> ${response.status} ${await response.text()}`);
  }
  // Deleting a user answers 200 with an empty body, and PostgREST writes return
  // nothing unless asked to. Checking the body rather than the status covers both
  // without having to know which endpoint does which.
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function deleteUserByEmail(supabaseUrl: string, serviceKey: string, email: string) {
  const page = await call(`${supabaseUrl}/auth/v1/admin/users?per_page=200`, serviceKey);
  const existing = (page.users ?? []).filter(
    (user: { email?: string }) => user.email?.toLowerCase() === email.toLowerCase(),
  );
  for (const user of existing) {
    await call(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, serviceKey, { method: "DELETE" });
  }
}

async function createUser(
  supabaseUrl: string,
  serviceKey: string,
  account: { email: string; password: string },
): Promise<string> {
  const created = await call(`${supabaseUrl}/auth/v1/admin/users`, serviceKey, {
    method: "POST",
    // Confirmed on creation: there is no mail step in this flow and an unconfirmed
    // user cannot sign in with a password.
    body: JSON.stringify({ ...account, email_confirm: true }),
  });
  return created.id;
}

/**
 * Drop and recreate both users and the owner's library.
 *
 * Idempotent by deletion rather than by upsert, so a run left half-finished by a
 * crash still starts from a known state.
 */
export async function seed() {
  const { supabaseUrl, serviceKey } = await config();

  for (const account of [OWNER, STRANGER]) {
    await deleteUserByEmail(supabaseUrl, serviceKey, account.email);
  }

  const ownerId = await createUser(supabaseUrl, serviceKey, OWNER);
  const strangerId = await createUser(supabaseUrl, serviceKey, STRANGER);

  const wanted = [
    ...TRACKS.map((track) => ({ ...track, userId: ownerId })),
    { ...STRANGER_TRACK, userId: strangerId },
  ];

  const rows = await call(`${supabaseUrl}/rest/v1/tracks`, serviceKey, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(
      wanted.map((track) => ({
        user_id: track.userId,
        title: track.title,
        artist: track.artist,
        genre: "Fixture",
        // No object exists at this key. Nothing under test reads the audio; only
        // extraction would, and it is not exercised here.
        file_ref: `${track.userId}/${track.title.replace(/\s+/g, "-").toLowerCase()}.mp3`,
        source: "upload",
      })),
    ),
  });

  await call(`${supabaseUrl}/rest/v1/audio_features`, serviceKey, {
    method: "POST",
    body: JSON.stringify(
      rows.map((row: { id: string; title: string }) => {
        const track = wanted.find((candidate) => candidate.title === row.title)!;
        return {
          track_id: row.id,
          status: "complete",
          bpm: track.bpm,
          key_camelot: track.key,
          energy: track.energy,
          danceability: 0.5,
          duration_seconds: 210,
          analyzed_at: new Date().toISOString(),
        };
      }),
    ),
  });

  return { ownerId, strangerId };
}

export async function teardown() {
  const { supabaseUrl, serviceKey } = await config();
  for (const account of [OWNER, STRANGER]) {
    await deleteUserByEmail(supabaseUrl, serviceKey, account.email);
  }
}
