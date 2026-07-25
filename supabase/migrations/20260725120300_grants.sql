-- Xfade v1 — role grants.
--
-- RLS decides *which rows* a role may touch; GRANTs decide whether it may touch
-- the table at all, and the privilege check runs first. Without these, every
-- PostgREST request from a signed-in user fails with 42501 "permission denied"
-- before any policy in 20260725120100_rls_policies.sql is evaluated.
--
-- Supabase's default privileges cover tables created through some paths, but not
-- tables created by CLI migrations, so granting explicitly is the portable fix
-- rather than relying on the environment to have done it.
--
-- `anon` is deliberately granted nothing: v1 has no anonymous access, every policy
-- targets `authenticated`, and an outright privilege error is a better failure
-- mode than an empty result set that looks like "no data".

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
    public.tracks,
    public.audio_features,
    public.combos,
    public.combo_notes,
    public.sessions,
    public.session_tracks
to authenticated;

-- The extraction job writes audio_features through the service-role client, which
-- bypasses RLS but still needs the underlying privilege.
grant select, insert, update, delete on
    public.tracks,
    public.audio_features,
    public.combos,
    public.combo_notes,
    public.sessions,
    public.session_tracks
to service_role;
