# Xfade — handoff

Orientation for picking this up cold, in a new session or by a new person. Written
2026-07-26 at `4957cfb`.

This file is the **map**. The detailed open items, with the measurements behind them,
live in [docs/v1.1-backlog.md](docs/v1.1-backlog.md) — read that before proposing work.
The original intent is in [docs/xfade-design-doc.md](docs/xfade-design-doc.md) and
[docs/xfade-v1-build-spec.md](docs/xfade-v1-build-spec.md).

---

## What this is

A DJ combo and transition logger. You upload tracks, it derives BPM, key and energy
from the audio itself, and it scores how well any two tracks mix using Camelot-wheel
and tempo rules.

The differentiator (design doc §1) is that features are **derived from the audio**
rather than typed in or imported — which is why there is an Essentia pipeline rather
than a form field. Single user, personal scale, free and open in intent.

## Current state

Everything in the v1 build spec is built, plus a UI pass modelled on a reference
implementation of the same idea.

| | |
|---|---|
| Repo | `github.com/rodrick-mpofu/xfade-dj` (public), `main` at `4957cfb` |
| Backend | FastAPI, 257 tests, ruff clean |
| Frontend | React + TS + Vite, 127 tests, typecheck clean |
| Database | Supabase — 7 migrations locally, **5 on hosted** (two behind) |
| CI | GitHub Actions, 3 jobs, green |
| Real data | 16 tracks from the owner's library in the local database |
| Deployed | No, deliberately — see backlog §7 |

**Working end to end:** upload → Supabase Storage → background Essentia extraction →
features → compatibility scoring, with combo logging, session planning, a dashboard,
a combos list, and harmonic suggestions.

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

Then <http://localhost:5173>. The Supabase CLI prints the local keys on start;
`backend/.env` and `frontend/.env` already hold them (both gitignored).

**The backend must run in Docker.** Essentia publishes no Windows wheels — only an
sdist needing a full C++ toolchain — so the container is not optional on this machine.
Everything else, including the whole test suite, runs natively.

To sign in: user `dj@example.com` exists in the local stack. There is no signup UI, so
new users are created via the Supabase dashboard or the admin API.

## Layout

```
backend/          FastAPI + Essentia. Dockerfile is the deployable unit.
  app/api/routes/ tracks, combos, sessions, compatibility, health
  app/core/       pure logic: compatibility scoring, Camelot mapping, tag reading
  app/services/   extraction job (orchestration) and audio_analysis (the DSP)
frontend/         React, Vite, Tailwind v4, TanStack Query, React Router
supabase/         migrations only — schema, RLS, grants, storage, functions
docs/             design doc, build spec, v1.1 backlog
.github/          CI
```

## How the pieces fit

- **Auth and data go through Supabase.** The browser holds a Supabase session; its JWT
  is attached to every backend request, and the backend builds a per-request client
  from that token so **RLS does the authorization**. The service-role client bypasses
  RLS and is reserved for the extraction job, which has no request context.
- **Extraction is a FastAPI `BackgroundTask`.** Upload returns immediately with the
  features row in `pending`; the job downloads the object, runs Essentia, and writes
  the result. The UI polls only while something is in flight.
- **Scoring is pure rules**, in `backend/app/core/compatibility.py`, with no database
  dependency beyond reading two feature rows.

## Decisions already made — do not relitigate without reason

Each of these was argued through and several were corrected by measurement.

- **Both key sources are stored.** Files carry BPM and key in ID3 tags; Essentia
  derives its own. Both are kept, and generated columns (`bpm_effective`,
  `key_camelot_effective` = `coalesce(tag, derived)`) decide which one scoring uses —
  the tag. Across the real library, 13 of 16 tracks have a key tag and **5 disagree**.
  Keeping both means the pipeline stays honest and the disagreements stay visible.
- **Energy is calibrated against this library, not an absolute scale.** It is three
  measures — loudness, brightness, activity — each mapped over the library's 5th–95th
  percentile and averaged. Picking those three was a measurement: eleven candidates
  over 235 files collapsed into exactly three independent clusters. The reading is
  "energetic for what I play", which is the useful one for a single user. The raw
  components live in `structure_markers` so the mapping can be re-derived without
  re-analysing. Note the frame geometry in `audio_analysis.py` is part of the
  calibration — changing `FRAME_SIZE` or `HOP_SIZE` invalidates the centroid range.
- **Audio under 30 seconds is refused, not analysed.** A DJ library holds one-shots;
  Essentia reported a 6-second airhorn as 136 BPM in 10B with *higher* beat confidence
  than any real track. Duration separates them cleanly where confidence does not.
- **Sessions and setlists stay fused.** A session owns its tracks directly. The
  reference design separates them; for one user that is overhead.
- **The UI is dark only.** No `dark:` variants. Six colour tokens in
  `frontend/src/index.css` under `@theme`; a re-theme is one file.
- **Reorder uses buttons, not drag-and-drop** — accessible and testable, and the
  backend primitive (replace the whole ordered list, atomically) already suits a drop
  handler if that changes.
- **Essentia is pinned to an exact pre-release.** Every published build is a
  pre-release, so installing with a bare `--pre` drags alpha fastapi, pydantic and
  supabase into the image. It did once; the pin is the fix.

## Things that will bite

- **Unit tests miss the interesting bugs here.** Of the real defects in this build,
  most were invisible to the suites and only appeared when something ran for real:
  missing table GRANTs (every authenticated request would have failed in production),
  a settings parse error that crashed the app at startup while 115 tests passed, and a
  placeholder string that only looked wrong on screen. **Verify against the running
  stack**, and after an optimistic write, reload to confirm it actually persisted.
- **`npm ci` wipes `node_modules`** and will fail or half-delete if the Vite dev
  server is holding files. Stop it first.
- **PowerShell re-tokenizes here-strings** passed to native commands, so a multi-line
  `git commit -m` containing double quotes fails. Write the message to a file and use
  `git commit -F`.
- **Essentia saturates the CPU** while running; concurrent API requests crawl and
  short client timeouts expire. Harmless with one user, relevant to any deploy.
- **mutagen does not expose `TKEY`** through its "easy" interface until registered —
  `EasyID3.RegisterTextKey("key", "TKEY")`. Without it, key tags read as absent.
- **Hosted is two migrations behind local.** Fine while working locally; `supabase db
  push` before anything depends on it.

## What is left

Full detail in [docs/v1.1-backlog.md](docs/v1.1-backlog.md), which opens with a
priority order. In short:

1. **Presentation for GitHub** — the README is written for someone building the
   project, not evaluating it, and there is no LICENSE despite the design doc saying
   free and open. Screenshots would carry a lot here.
2. **A browser-level test** — CI covers the database seam via `supabase db reset`;
   nothing covers the UI seam, which is the same blind spot listed above.
3. **Deployment** — assessed and parked. Blockers are a 1.85 GB library against
   Supabase's 1 GB free tier, Essentia wanting ≥1 GB RAM, and `BackgroundTasks` losing
   in-flight jobs to any restart or idle-stop.

`energy` was the last measured feature-quality problem and is now closed — RMS is
replaced by a composite of perceptual loudness, spectral centroid and onset rate,
calibrated against the whole 235-track library (backlog §2).

Smaller: no combo edit, no session rename, genre only populated on upload so existing
tracks show none, and the compatibility weights are conventional heuristics that
should eventually be tuned against real ratings.

**Explicitly out of scope** (design doc §8): content-based recommendations and
similarity search (v2 — `pgvector` is already enabled so it is an `ALTER TABLE`),
collaborative filtering, auto-detection of combos from a recorded set (v3), and mobile
layout.

## Working conventions

- **Git is driven explicitly.** Branch, commit, `git merge --ff-only` into `main`,
  push — and only when asked. Verify with `git ls-remote`.
- **Confirm design choices before large changes**, rather than presenting them
  afterwards.
- **Say plainly what was verified and what was not.** Several conclusions in the
  backlog exist because a confident claim turned out to be wrong and was corrected in
  writing; that is the intended standard, not an embarrassment.
