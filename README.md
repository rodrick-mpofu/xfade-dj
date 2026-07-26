# Xfade

[![CI](https://github.com/rodrick-mpofu/xfade-dj/actions/workflows/ci.yml/badge.svg)](https://github.com/rodrick-mpofu/xfade-dj/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A DJ combo and transition logger that listens to your music instead of trusting its
metadata.**

Upload a track and Xfade derives its BPM, key and energy from the audio itself, then
scores how well any two tracks mix using real Camelot-wheel and tempo rules. Log the
combinations that worked, plan a set, and get harmonic suggestions for what to play
next.

Most tools in this space ask you to type the metadata in, or import it from Serato or
Rekordbox. That is the part Xfade does differently: there is an
[Essentia](https://essentia.upf.edu/) DSP pipeline where the form field would be.

---

## Why derive it rather than import it

Because the tags are often wrong, and you cannot tell which ones without a second
opinion.

Across a real 16-track sample, tag and derived **BPM agreed every time** — but **13
carried a key tag and 5 of those disagreed with the audio**. Two disagreed badly
enough to flip a compatible pair into a clash.

So Xfade stores both, and generated columns (`coalesce(tag, derived)`) decide which
one scoring uses. The disagreements stay visible instead of being quietly resolved,
and extraction remains the only source for the quarter of a library with no key tag
at all — or for anything unreleased.

## What it does

- **Library** — upload, sortable BPM/key/genre/duration columns, live extraction status
- **Compatibility scoring** — 0–100 for any pair, with the reasoning spelled out
- **Combo logger** — log a transition with technique, rating and notes, scored live
- **Session planner** — build an ordered setlist
- **Harmonic suggestions** — what mixes well with this track, ranked
- **Dashboard** — library and combo stats at a glance

## The interesting parts

**Energy is a measurement, not a guess.** It combines perceptual loudness (LUFS),
spectral centroid and onset rate — one per independent axis. Which three was decided
by computing eleven candidates over the whole 235-file library and reading the rank
correlations: they collapsed into exactly three clusters carrying separate
information. Spectral flux *looks* like a measure of drive and is not — it correlates
0.85 with LUFS. See [Extraction](#extraction).

**One-shots are refused, not analysed.** A DJ library holds airhorns and sirens
alongside tracks, and Essentia answers for them just as confidently. A 6-second
airhorn came back as 136 BPM in 10B with *higher* beat confidence than any real track.
Confidence does not separate them; duration does, with a wide gap.

**RLS is the authorization model**, not a layer on top of one. The browser's JWT is
attached to every backend request and the backend builds a per-request Supabase client
from it, so Postgres policies do the enforcing.

**Scoring is pure rules.** No model, no ML — v2 territory by design. The weights are
named constants precisely so they are easy to argue with.

## Stack

React + TypeScript + Vite · FastAPI · Essentia · Supabase (Postgres, Auth, Storage)

```
backend/          FastAPI + Essentia. The Dockerfile is the deployable unit.
  app/api/routes/ tracks, combos, sessions, compatibility, health
  app/core/       pure logic: compatibility scoring, Camelot mapping, tag reading
  app/services/   extraction job (orchestration) and audio_analysis (the DSP)
frontend/         React, Tailwind v4, TanStack Query, React Router
supabase/         migrations only — schema, RLS, grants, storage, functions
docs/             design doc, v1 build spec, v1.1 backlog
```

The [design doc](docs/xfade-design-doc.md) is the why, the
[v1 build spec](docs/xfade-v1-build-spec.md) is the what, and the
[v1.1 backlog](docs/v1.1-backlog.md) is everything known-open — including the items
where a confident early claim was later corrected by measurement.

## Status

**v1 is complete**: every item in design doc §8's MVP scope is built, plus a UI pass.
257 backend tests, 127 frontend tests, CI green on three jobs.

Not deployed, deliberately — the constraints are assessed and written down in backlog
§7. For a single-user tool, `docker compose up` on the laptop is a legitimate end
state.

Deferred by design (design doc §8, build spec §3): content-based recommendations and
similarity search, collaborative filtering, auto-detection of combos from a recorded
set, DJ-software library import, and mobile layout.

---

## Running it

Three processes. All three are needed for the full loop.

```bash
npx supabase start
```

```bash
docker compose up -d
```

```bash
npm run dev --prefix frontend
```

Then <http://localhost:5173>. The Supabase CLI prints the local keys on start; copy
`backend/.env.example` and `frontend/.env.example` to `.env` and fill them in. Only
the **anon** key belongs in the frontend file — everything there ships to the browser.

There is no signup UI, so create a user with the service-role key via
`POST /auth/v1/admin/users`.

### Why the backend must run in Docker

Essentia publishes no Windows wheels — only an sdist needing a full C++ toolchain — so
on Windows the container is not optional. It carries ffmpeg and libsndfile for
mp3/m4a/aac/flac decoding, and it is the same image that would deploy (build spec §1).

Essentia is imported lazily, so everything *except* the extraction DSP runs natively,
including the whole test suite. If you point `SUPABASE_URL` at a local stack from
inside the container, use `http://host.docker.internal:54321` — `localhost` there is
the container itself.

### Working natively

Backend, from `backend/` with Python 3.11+:

```bash
python -m venv .venv && .venv/Scripts/activate && pip install -e ".[dev]"
```

```bash
pytest
```

Frontend, from `frontend/`: `npm install`, then `npm test` for Vitest and
`npm run types:api` to regenerate TypeScript types from a running backend's OpenAPI
schema.

`GET /health` is a liveness check, `GET /health/db` round-trips to Postgres, and
interactive API docs are at `/docs`.

### Database

Seven migrations in `supabase/migrations/` build six tables with RLS on and four
policies each. `supabase start` applies them automatically and `supabase db reset`
replays them from scratch; CI runs the latter on every push, which is the only thing
that catches a missing GRANT.

To push to a hosted project:

```bash
supabase link --project-ref <your-project-ref>
```

```bash
supabase db push
```

---

## Extraction

`POST /tracks` queues a background job that downloads the object, runs Essentia's
`RhythmExtractor2013` (BPM) and `KeyExtractor` (key + scale → Camelot), and writes
`audio_features`. The row moves `pending` → `processing` → `complete` | `failed`, and
track detail reports that state so the UI shows progress instead of blocking.

`POST /tracks/{id}/extract` re-queues extraction from any state — which is how a track
picks up an improved pipeline, not just how a failure gets retried.

Verified against synthesized audio in-container: a planted 120.0 BPM click track in A
minor came back as **119.97 BPM / 8A**. Against real music, tempo detection matched
the file's own tags on 13 of 13 tracks with no half/double errors.

### Energy

Three measures, one per independent axis: **perceptual loudness (LUFS)**, **spectral
centroid** and **onset rate**, each mapped over the library's 5th–95th percentile and
averaged.

The choice was a measurement. Eleven candidates were computed over all 235 files (227
usable — the 8 skips were all one-shots) and their rank correlations sorted into three
clusters:

| Axis | Members | Within cluster | vs. loudness |
|---|---|---|---|
| Loudness | rms, **lufs**, loudness_vickers, flux | 0.68–0.90 | — |
| Brightness | **centroid**, rolloff, high_band_ratio | 0.82–0.96 | −0.12 to −0.33 |
| Activity | **onset_rate** | — | −0.03 |

This replaced plain RMS, which measured loudness rather than drive and used 0.12–0.42
of its range:

| | min | p50 | max | vs. RMS |
|---|---|---|---|---|
| RMS (before) | 0.033 | 0.290 | 0.499 | — |
| Composite (after) | 0.000 | **0.544** | 1.000 | Spearman **0.31** |

Every decile is populated, and a rank correlation of 0.31 against RMS means it ranks
something genuinely different. The clearest climbers are amapiano and afro remixes —
busy and bright but not loudly mastered, so RMS buried them. Two acapellas landed at
the floor with nothing having been told what an acapella is.

Two honest caveats. The calibration describes *this* library, so energy reads as
"energetic for what I play" rather than an absolute scale — the raw components are
stored in `structure_markers` so it can be re-derived without re-analysing. And
`onset_rate` correlates 0.52 with BPM, so energy inherits some tempo.

`danceability` behaves sensibly on real music (0.19–0.57). Neither feeds the
compatibility score, which uses Camelot and BPM only.

## Compatibility scoring

`GET /compatibility?track_a={id}&track_b={id}` returns a 0–100 score plus the
reasoning, computed on the fly from two `audio_features` rows.

Harmony is weighted 0.6 against tempo's 0.4: a tempo gap is correctable with the pitch
fader mid-mix, a key clash is not. Camelot distance is measured around the wheel, so
12A and 1A are neighbours. Tempos within ~3% score full marks, and half/double-time
pairs (70 against 140) are matched on the doubled tempo rather than scored as a 100%
miss.

The weights and thresholds in [compatibility.py](backend/app/core/compatibility.py)
are conventional DJ heuristics, not validated values — named constants so they are
easy to argue with. Tuning them against logged ratings is backlog §3.

When either track has no features yet the response carries a `status` instead of a
score: `pending_extraction` (worth polling), `extraction_failed` (terminal, offer a
retry), or `missing_features`.

## Setlists

`PUT /sessions/{id}/tracks` replaces the whole ordered list — one primitive covering
add, remove and reorder, which is how drag-and-drop planners actually behave. It goes
through the `set_session_tracks` Postgres function rather than a DELETE followed by an
INSERT: over PostgREST those are two round trips with no transaction between them, and
a failure in the middle would leave a hand-curated setlist empty.

The function is `SECURITY INVOKER`, so RLS still applies — including the policy that
re-checks every referenced track belongs to the caller.

## Design notes

**RLS needs GRANTs to go with it.** Privilege checks run *before* policies, so a table
with perfect policies and no grant fails every request with 42501. That is what
`20260725120300_grants.sql` is for, and it shipped missing once — every unit test
passed straight through it. `anon` is granted nothing on purpose.

**Storage keys are load-bearing.** Objects live at `<user_id>/<track_id>.<ext>` in the
private `tracks` bucket, and the storage policies key off that first path segment.

**Deleting a track deletes more than the track.** Foreign keys cascade, so it also
removes every combo the track appears in, those combos' notes, and its place in any
setlist. Right for the database — a combo without its tracks is meaningless — but more
than the word "delete" implies, so the UI says so before asking.

**Sorting by key uses wheel order, not string order.** As strings `10A` sorts between
`1A` and `2A`, scattering neighbouring keys, which defeats the point of sorting by key.

**The Library polls only when it needs to.** Extraction is a background job with no
push channel, so `useTracks` sets `refetchInterval` only while something is `pending`
or `processing`. An idle library makes no requests.

## License

[MIT](LICENSE).
