# Xfade v1 — Build Spec for Claude Code

Source of truth for scope/architecture: `xfade-design-doc.md` (v0.1). This spec narrows that doc into a concrete, buildable v1.

---

## 1. Locked-in decisions (as of this spec)

- **Platform**: Web app, purely. No native/hybrid mobile build.
- **Layout target**: Desktop-scale first (laptop-width). Mobile responsiveness deferred to a later pass.
- **Frontend**: React
- **Backend**: Python, FastAPI
- **Database**: Supabase (Postgres + pgvector + Storage + Auth) — replaces the standalone Postgres/S3/VecDB split in the original design doc's Storage layer. `DB` and `VecDB` collapse into one Supabase Postgres instance; `Blob` maps to Supabase Storage.
- **Audio processing**: Essentia (preferred) or librosa, run server-side in the FastAPI backend as an async job — not in Supabase Edge Functions (those run Deno/TS, not suited to native audio libraries).
- **No-code/AI app builder (e.g. Base44)**: not used. Full implementation via Claude Code, single codebase.
- **Repo structure**: monorepo (frontend + backend together), single owner, personal-scale project.

## 2. Open items to resolve before/at kickoff (from design doc §9, still open)

1. **Final project name** — needed before scaffolding repo/package names. Placeholder `xfade` used below; replace throughout if a name is chosen.
2. Personal-use-only vs. eventually shareable — affects whether it's worth reserving multi-user considerations in the schema now (e.g. keeping `user_id` FKs everywhere even though there's one user today). Recommendation: keep `user_id` on all tables from the start since Supabase Auth gives you this for free — cheap to include now, expensive to retrofit.
3. How much existing library metadata (Rekordbox/Serato/Traktor export) exists to bootstrap from vs. raw files needing full extraction — affects whether an import step is in scope for v1 or deferred.

## 3. v1 Scope (from design doc §8, unchanged)

**In scope:**
- [ ] Track library (manual upload; DJ-software export import is stretch, not required for v1)
- [ ] Manual combo logging with notes/technique/rating
- [ ] Session/setlist planning
- [ ] Audio feature extraction pipeline (BPM, key, energy) via Essentia, run async on upload
- [ ] Rules-based Camelot wheel + BPM-delta compatibility score shown per track pair

**Explicitly deferred (do not build in v1):**
- Content-based recommendations / similarity search (v2)
- Collaborative filtering signals (v2+, and only if project ever goes multi-user)
- Auto-detection of combos from a recorded set (v3, needs its own isolated prototype first)
- Mobile-responsive layout
- DJ-software export import (Rekordbox/Serato/Traktor)

## 4. Data model (Supabase Postgres)

Adapted from design doc §4. Same entities; `AUDIO_FEATURES.structure_markers` and any vector columns use pgvector where applicable.

```
users            -- managed by Supabase Auth, referenced by user_id FKs below
tracks           (id, user_id, title, artist, file_ref, source, created_at)
audio_features   (track_id FK -> tracks.id, bpm, key_camelot, energy, danceability, structure_markers jsonb)
combos           (id, user_id, track_a_id FK, track_b_id FK, technique, rating, logged_at)
combo_notes      (id, combo_id FK, text)
sessions         (id, user_id, name, planned_for)
session_tracks   (session_id FK, track_id FK, position)
```

Notes:
- `audio_features.track_id` is 1:1 with `tracks.id` (one extraction record per track).
- Feature vectors for future similarity search (v2) can be added as a `vector` column on `audio_features` later via pgvector — no need to build this in v1, but worth knowing the column can be added without a schema redesign.
- Row-level security (RLS) should scope every table to `user_id = auth.uid()` even for single-user use — it's the Supabase-idiomatic way to do auth and costs nothing extra now.

## 5. Backend (FastAPI)

**Core endpoints, v1:**
- `POST /tracks` — upload track (audio file -> Supabase Storage, metadata row -> `tracks`), triggers async extraction job
- `GET /tracks` — list library
- `GET /tracks/{id}` — track detail incl. `audio_features` if extraction complete
- `POST /combos` — log a combo (track_a, track_b, technique, rating, notes)
- `GET /combos` — list logged combos
- `POST /sessions`, `GET /sessions`, `POST /sessions/{id}/tracks` — session/setlist CRUD
- `GET /compatibility?track_a={id}&track_b={id}` — rules-based Camelot + BPM-delta score, computed on the fly from `audio_features` (no ML, no stored model — see design doc §5)

**Extraction job:**
- Triggered on track upload, runs Essentia async (background task or lightweight queue — a simple `BackgroundTasks` call is enough for personal-scale v1; no need for Celery/Redis yet)
- Writes results into `audio_features` on completion
- Track detail endpoint should reflect "extraction pending" vs "complete" state so the frontend can show a status rather than blocking

## 6. Frontend (React, desktop-scale)

**Views, v1:**
- **Library** — sortable table of tracks with BPM/key/energy columns visible at a glance (not a card stack — desktop layout has room for this)
- **Track detail** — extraction status, feature values, list of combos this track appears in
- **Combo logger** — form to log a new combo (pick track A/B, technique, rating, notes); should surface the compatibility score live as tracks are selected
- **Session planner** — build/reorder a setlist, see per-adjacent-pair compatibility scores inline

**Explicitly not built in v1:** responsive/mobile breakpoints, recommendation UI, auto-detection UI.

## 7. Suggested build order for Claude Code

1. Supabase schema + RLS policies (§4)
2. FastAPI skeleton with Supabase client wired up, health check
3. Track CRUD + Storage upload endpoint (no extraction yet — stub the job)
4. Essentia extraction job, wired to the upload trigger
5. Compatibility scoring function (pure rules, no DB dependency beyond reading `audio_features`)
6. Combo + session CRUD endpoints
7. React shell (routing, layout) — Library view first since everything else depends on having tracks
8. Combo logger view, wired to compatibility endpoint
9. Session planner view

## 8. Non-goals reminder

Don't let Claude Code get pulled into building v2/v3 scope (recommendations, auto-detection) while implementing v1 — the design doc's incremental-build philosophy (§2: "each version should be independently useful, not blocked on the hardest feature") is a deliberate constraint, not just a nice-to-have.
