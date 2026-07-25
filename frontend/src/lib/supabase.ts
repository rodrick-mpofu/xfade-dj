import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. Copy frontend/.env.example to frontend/.env.",
  );
}

/**
 * Browser client. Used only for auth — all data goes through the FastAPI backend,
 * which is where the compatibility scoring and the extraction trigger live.
 *
 * The session is persisted here, and its access token is what `lib/api.ts` puts on
 * every backend request so RLS sees the right user.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
