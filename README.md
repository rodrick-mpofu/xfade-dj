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

Build spec §7 steps 1–3 are done: schema, FastAPI skeleton, and track CRUD with
Storage upload (`POST /tracks`, `GET /tracks`, `GET /tracks/{id}`). Extraction is
stubbed — uploads land in state `pending` and stay there until step 4. The `combos`
and `sessions` routers are registered but still have no handlers.

Nothing has been exercised against a real Supabase project yet; the test suite runs
against a fake client.

## Setup

### 1. Database

The migrations are written but have not been run against any project.

```bash
supabase link --project-ref <your-project-ref>
```

```bash
supabase db push
```

Without the CLI, paste the three files in `supabase/migrations/` into the SQL editor
in filename order. For a local stack instead, `supabase start` applies them
automatically (needs Docker).

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

## Design notes worth knowing

**RLS is the authorization model.** Request handlers use a Supabase client carrying
the caller's JWT (`get_db` in [deps.py](backend/app/api/deps.py)), so the policies in
`20260725120100_rls_policies.sql` do the enforcing. The service-role client bypasses
RLS entirely and is reserved for the extraction job, which has no request context.

**Storage keys are load-bearing.** Objects live at `<user_id>/<track_id>.<ext>` in the
private `tracks` bucket; the storage policies key off that first path segment.

**Essentia does not ship Windows wheels.** Step 4 of the build order will need either
Docker/WSL for the backend, or librosa — which the build spec allows as the fallback
("Essentia (preferred) or librosa"). Nothing before that step is affected.
