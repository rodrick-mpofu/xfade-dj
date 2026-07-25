# xfade — frontend (placeholder)

Not built yet. This directory exists so the monorepo shape is real; the React app
lands at build-spec §7 steps 7–9, after the backend endpoints it depends on.

Planned per build spec §6 (desktop-scale, React, no mobile breakpoints in v1):

| View | Depends on |
|---|---|
| Library — sortable table, BPM/key/energy columns | `GET /tracks` |
| Track detail — extraction status, features, combos | `GET /tracks/{id}` |
| Combo logger — live compatibility score as A/B are picked | `POST /combos`, `GET /compatibility` |
| Session planner — reorderable setlist, per-adjacent-pair scores | `/sessions` CRUD, `GET /compatibility` |

Explicitly **not** in v1: responsive/mobile layout, recommendation UI, auto-detection UI.

The backend already allows `http://localhost:5173` through CORS, so a Vite scaffold
will talk to it without further config.
