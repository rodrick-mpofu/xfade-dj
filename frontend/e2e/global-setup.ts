/**
 * Check the stack is actually up, then seed.
 *
 * The reachability check exists because the failure otherwise arrives as a browser
 * timeout on a blank page, which says nothing about which of the three processes is
 * missing.
 */

import { seed } from "./fixtures";

const APP_URL = process.env.XFADE_APP_URL ?? "http://localhost:5173";
const API_URL = process.env.XFADE_API_URL ?? "http://localhost:8000";

async function reachable(url: string, what: string, hint: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`${what} is not responding at ${url} (${error}).\n  Start it with: ${hint}`);
  }
}

export default async function globalSetup() {
  await reachable(`${API_URL}/health`, "The backend", "docker compose up -d");
  await reachable(APP_URL, "The frontend", "npm run dev --prefix frontend");
  await seed();
}
