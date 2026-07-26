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
| Combo logger — live compatibility score | built | `POST /combos`, `GET /compatibility` |
| Sessions — list, create, delete | built | `GET/POST/DELETE /sessions` |
| Session planner — reorderable setlist | built | `/sessions` CRUD, `GET /compatibility` |

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

**The combo logger carries track B over to deck A after logging.** A set is a chain —
what you mixed into is what you mix out of next — so logging a run of transitions
does not mean re-picking the same track every time. Design doc §2 calls logging
friction the make-or-break factor.

**An unscoreable pair is still loggable.** If either track's analysis is pending or
failed, the panel says which and the form still submits. The score is an aid, not a
gate.

**Destructive actions state their consequence, not just their name.** `ConfirmDialog`
takes a `consequence` prop because "Delete" alone is a lie here: deleting a track also
deletes every combo it appears in, so the dialog counts them. The session dialog says
the opposite — that the music is *not* affected — because that is equally non-obvious.

**Reordering a setlist is optimistic, and rolls back on failure.** Waiting a round
trip per click makes reordering feel broken, so the move applies immediately and the
previous order is restored if the write fails — the UI never silently disagrees with
the database.

**Reorder uses buttons, not drag-and-drop.** Accessible and testable with no extra
dependency. Drag-and-drop would be nicer to use and is a reasonable later change; the
backend primitive (replace the whole ordered list) already supports it.

**`npm run types:api`** regenerates types from a running backend's OpenAPI schema.
The hand-written shapes in `types/xfade.ts` are what the views use; if the two
disagree, the backend is right.
