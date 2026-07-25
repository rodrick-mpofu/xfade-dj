# xfade — frontend

React + TypeScript, Vite, React Router, TanStack Query, Tailwind. Desktop-scale
only; mobile breakpoints are explicitly deferred (build spec §3).

Setup and environment variables are in the [root README](../README.md).

```bash
npm install && npm run dev
```

## Views

| View | Status | Depends on |
|---|---|---|
| Login | built | Supabase Auth |
| Library — sortable table, BPM/key/energy | built | `GET /tracks` |
| Track detail — extraction status, features, combos | built | `GET /tracks/{id}`, `GET /combos` |
| Combo logger — live compatibility score | build spec §7 step 8 | `POST /combos`, `GET /compatibility` |
| Session planner — reorderable setlist | build spec §7 step 9 | `/sessions` CRUD, `GET /compatibility` |

The login screen is not in the spec's view list, but every backend endpoint requires
a JWT, so there is no working Library without one.

## Layout

```
src/
├─ main.tsx, App.tsx        providers, router, app shell
├─ lib/supabase.ts          browser client — auth only, all data goes via the API
├─ lib/auth.tsx             session context
├─ lib/api.ts               typed fetch wrapper, attaches the JWT
├─ lib/sortTracks.ts        pure sort logic, unit tested
├─ hooks/useTracks.ts       queries, mutations, extraction polling
├─ types/xfade.ts           response shapes (see `npm run types:api`)
├─ routes/                  Login, Library, TrackDetail
└─ components/              TrackTable, UploadDialog, ExtractionStatus
```

## Notes

**Polling is conditional.** Extraction is a background job with no push channel, so
`useTracks` sets `refetchInterval` only while a track is `pending` or `processing`.
An idle library makes no requests.

**Key sorting follows the Camelot wheel.** As strings, `10A` sorts between `1A` and
`2A` and neighbouring keys scatter — which defeats the point of sorting by key.

**Unanalysed tracks sort last in both directions**, so a fresh upload with no BPM
never displaces the rows you were looking at.

**`npm run types:api`** regenerates types from a running backend's OpenAPI schema.
The hand-written shapes in `types/xfade.ts` are what the views use; if the two
disagree, the backend is right.
