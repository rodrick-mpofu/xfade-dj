# Xfade

ML-forward DJ combo & transition logger. Log the track combinations you discover,
get compatibility scoring grounded in real audio analysis rather than typed-in metadata.

Scope and architecture live in [docs/](docs/):
[design doc](docs/xfade-design-doc.md) (the why) and
[v1 build spec](docs/xfade-v1-build-spec.md) (the what, narrowed to v1).

## Layout

```
supabase/     Postgres schema, RLS policies, storage bucket (migrations only — not applied)
backend/      FastAPI app + Essentia extraction pipeline
frontend/     React app (not built yet — build spec §7 steps 7–9)
docs/         design doc + build spec
```

## Status

**v1 is complete.** All nine steps of the build spec §7 order are done, and every item
in the design doc §8 MVP scope is built: track library with upload, manual combo
logging with notes/technique/rating, session planning, Essentia feature extraction,
and rules-based Camelot/BPM compatibility.

Deferred by design (design doc §8, build spec §3): content-based recommendations,
collaborative signals, auto-detection from recorded sets, mobile-responsive layout,
and DJ-software library import.

The whole pipeline has been exercised end to end against a live local stack: upload
→ Storage → Essentia extraction → features → compatibility score, plus combo and
session CRUD with two-user RLS isolation. Migrations are also applied to the hosted
project, though the functional isolation checks were only run locally.

## Setup

### 1. Database

The migrations are written but have not been run against any project.

```bash
supabase link --project-ref <your-project-ref>
```

```bash
supabase db push
```

Without the CLI, paste the four files in `supabase/migrations/` into the SQL editor
in filename order. For a local stack instead, `supabase start` applies them
automatically (needs Docker), and `supabase db reset` replays them from scratch.

The migrations have been applied and verified against a local stack: all six tables
with RLS on and four policies each, two-user isolation confirmed (including that one
user cannot log a combo referencing another's track, or write into their storage
folder), plus the Camelot and `complete`-requires-values constraints.

### 2. Backend

From `backend/`, with Python 3.11+:

```bash
python -m venv .venv && .venv/Scripts/activate && pip install -e ".[dev]"
```

Copy `backend/.env.example` to `backend/.env` and fill in the three Supabase values
(dashboard → Project Settings → API, or printed by `supabase start`).

```bash
uvicorn app.main:app --reload
```

`GET /health` is a liveness check; `GET /health/db` round-trips to Postgres and will
fail until the migrations are applied. Interactive docs at `/docs`.

```bash
pytest
```

The host venv deliberately has **no Essentia** — it publishes no Windows wheels, only
an sdist needing a full C++ toolchain. It is imported lazily, so everything except
the extraction DSP runs natively, and the whole test suite passes on Windows.

### 3. Running with Docker (required for extraction)

```bash
docker compose up --build
```

Needs `backend/.env` to exist. The image carries Essentia plus ffmpeg and libsndfile
for mp3/m4a/aac/flac decoding, and matches what gets deployed (build spec §1).

If you point `SUPABASE_URL` at a *local* `supabase start` stack, use
`http://host.docker.internal:54321` — `localhost` inside the container is the
container itself.

### 4. Frontend

From `frontend/`:

```bash
npm install
```

Copy `frontend/.env.example` to `frontend/.env`. Only the **anon** key goes here —
everything in that file ships to the browser.

```bash
npm run dev
```

Vite serves on `http://localhost:5173`, the origin the backend's CORS allowlist
names. `npm test` runs the Vitest suite; `npm run types:api` regenerates TypeScript
types from a running backend's OpenAPI schema.

You need a Supabase Auth user to sign in. On the local stack, create one with the
service-role key via `POST /auth/v1/admin/users`.

## Frontend

React + TypeScript, React Router, TanStack Query, Tailwind. Desktop-scale only —
mobile breakpoints are explicitly deferred (build spec §3).

Built so far: a login screen (not in the spec's view list, but every endpoint needs a
JWT), the app shell, the Library table, and track detail.

Two things worth knowing:

**The Library polls, but only when it needs to.** Extraction is a background job with
no push channel, so `useTracks` sets `refetchInterval` only while some track is
`pending` or `processing`. An idle library makes no requests.

**Sorting by key uses wheel order, not string order.** As strings, `10A` sorts between
`1A` and `2A`, scattering neighbouring keys — which defeats the point of sorting by
key at all.

## Extraction

`POST /tracks` queues a background job that downloads the object, runs Essentia's
`RhythmExtractor2013` (BPM) and `KeyExtractor` (key + scale → Camelot), and writes
`audio_features`. The row moves `pending` → `processing` → `complete` | `failed`;
track detail reports that state so the UI can show progress instead of blocking.

Verified against synthesized audio in-container: a planted 120.0 BPM click track in
A minor came back as **119.97 BPM / 8A**.

Anything shorter than 30 seconds is refused rather than analysed — a DJ library holds
one-shots, and Essentia answers for a 6-second airhorn as confidently as for a track.
`POST /tracks/{id}/extract` re-queues extraction from any state, which is how a track
picks up an improved pipeline as well as how a failure gets retried.

`energy` is RMS — a stand-in for loudness, not intensity, and it discriminates poorly
in practice (0.12–0.42 across a real library). `danceability` behaves sensibly on real
music (0.19–0.57). Neither feeds the compatibility score, which uses Camelot and BPM
only.

## Compatibility scoring

`GET /compatibility?track_a={id}&track_b={id}` returns a 0–100 score plus the
reasoning, computed on the fly from the two `audio_features` rows. Pure rules — no
model, no ML (design doc §5 defers that to v2).

Harmony is weighted 0.6 against tempo's 0.4: a tempo gap is correctable with the
pitch fader mid-mix, a key clash is not. Camelot distance is measured around the
wheel, so 12A and 1A are neighbours. Tempos within ~3% score full marks, and
half/double-time pairs (70 against 140) are matched on the doubled tempo rather
than scored as a 100% miss.

The weights and thresholds in [compatibility.py](backend/app/core/compatibility.py)
are conventional DJ heuristics, not validated values. They are named constants so
they are easy to argue with.

When either track has no features yet, the response carries a `status` instead of a
score: `pending_extraction` (still running, worth polling), `extraction_failed`
(terminal, offer a retry), or `missing_features`.

## Setlists

`PUT /sessions/{id}/tracks` replaces the whole ordered list — one primitive covering
add, remove, and reorder, which is how drag-and-drop planners actually behave. It
goes through the `set_session_tracks` Postgres function rather than a DELETE
followed by an INSERT: over PostgREST those are two round trips with no transaction
between them, and a failure in the middle would leave a hand-curated setlist empty.

The function is `SECURITY INVOKER`, so RLS still applies — including the policy that
re-checks every referenced track belongs to the caller. `POST /sessions/{id}/tracks`
remains for appending a single track.

## Design notes worth knowing

**RLS is the authorization model.** Request handlers use a Supabase client carrying
the caller's JWT (`get_db` in [deps.py](backend/app/api/deps.py)), so the policies in
`20260725120100_rls_policies.sql` do the enforcing. The service-role client bypasses
RLS entirely and is reserved for the extraction job, which has no request context.

**RLS needs GRANTs to go with it.** Privilege checks run *before* policies, so a
table with perfect policies and no grant fails every request with 42501. That is what
`20260725120300_grants.sql` is for. `anon` is granted nothing on purpose — v1 has no
anonymous access.

**Storage keys are load-bearing.** Objects live at `<user_id>/<track_id>.<ext>` in the
private `tracks` bucket; the storage policies key off that first path segment.

**Deleting a track deletes more than the track.** The foreign keys cascade, so it also
removes every combo the track appears in, those combos' notes, and its place in any
setlist. That is the right database behaviour — a combo without its tracks is
meaningless — but it is more than the word "delete" implies, so any UI needs to say so
before asking.

**Essentia does not ship Windows wheels.** Step 4 of the build order will need either
Docker/WSL for the backend, or librosa — which the build spec allows as the fallback
("Essentia (preferred) or librosa"). Nothing before that step is affected.
