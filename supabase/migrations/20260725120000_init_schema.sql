-- Xfade v1 — core schema.
-- Mirrors build spec §4. Every top-level table carries user_id even though the
-- project is single-user today: Supabase Auth gives it for free, and it is cheap
-- now / expensive to retrofit (build spec §2.2).

create extension if not exists "pgcrypto" with schema extensions;

-- Not used in v1. Enabled up front so the v2 similarity work (design doc §5) is a
-- plain `alter table audio_features add column embedding vector(N)` rather than a
-- migration that has to touch extensions on a live database.
create extension if not exists "vector" with schema extensions;


-- ---------------------------------------------------------------------------
-- tracks
-- ---------------------------------------------------------------------------

create table public.tracks (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    title      text not null check (length(trim(title)) > 0),
    artist     text,
    -- Object key within the private `tracks` storage bucket, e.g. "<user_id>/<uuid>.mp3".
    -- Nullable so a metadata-only row can exist before the upload completes.
    file_ref   text,
    source     text not null default 'upload' check (source in ('upload', 'import')),
    created_at timestamptz not null default now()
);

comment on table public.tracks is 'User''s track library. One row per audio file.';
comment on column public.tracks.file_ref is 'Object key in the private `tracks` Supabase Storage bucket.';

create index tracks_user_id_created_at_idx on public.tracks (user_id, created_at desc);


-- ---------------------------------------------------------------------------
-- audio_features  (1:1 with tracks — track_id is the primary key)
-- ---------------------------------------------------------------------------

-- Beyond the column list in build spec §4: §5 requires the track-detail endpoint
-- to distinguish "extraction pending" from "complete", which needs somewhere to
-- record job state. The row is created alongside the track in state 'pending'.
create type public.extraction_status as enum ('pending', 'processing', 'complete', 'failed');

create table public.audio_features (
    track_id          uuid primary key references public.tracks (id) on delete cascade,
    status            public.extraction_status not null default 'pending',
    bpm               real check (bpm > 0 and bpm < 400),
    -- Camelot wheel notation: 1A–12B. Drives the compatibility rules (design doc §5).
    key_camelot       text check (key_camelot ~ '^(1[0-2]|[1-9])[AB]$'),
    energy            real check (energy between 0 and 1),
    danceability      real check (danceability between 0 and 1),
    structure_markers jsonb,
    -- Populated when status = 'failed', so a retry has something to report.
    error_message     text,
    analyzed_at       timestamptz,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),

    constraint audio_features_complete_has_values
        check (status <> 'complete' or (bpm is not null and key_camelot is not null))
);

comment on table public.audio_features is 'Essentia extraction output, one row per track. Written by the backend extraction job.';

create index audio_features_status_idx on public.audio_features (status) where status in ('pending', 'processing');


-- ---------------------------------------------------------------------------
-- combos
-- ---------------------------------------------------------------------------

create table public.combos (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    track_a_id uuid not null references public.tracks (id) on delete cascade,
    track_b_id uuid not null references public.tracks (id) on delete cascade,
    technique  text,
    rating     smallint check (rating between 1 and 5),
    logged_at  timestamptz not null default now(),

    constraint combos_distinct_tracks check (track_a_id <> track_b_id)
);

comment on table public.combos is 'A logged A->B transition. Directional: A into B is not the same combo as B into A.';

create index combos_user_id_logged_at_idx on public.combos (user_id, logged_at desc);
create index combos_track_a_id_idx on public.combos (track_a_id);
create index combos_track_b_id_idx on public.combos (track_b_id);


-- ---------------------------------------------------------------------------
-- combo_notes
-- ---------------------------------------------------------------------------

create table public.combo_notes (
    id         uuid primary key default gen_random_uuid(),
    combo_id   uuid not null references public.combos (id) on delete cascade,
    -- Quoted: `text` is also a type name, so the bare identifier is ambiguous in
    -- expression position. The column name itself is plain lowercase `text`.
    "text"     text not null check (length(trim("text")) > 0),
    created_at timestamptz not null default now()
);

create index combo_notes_combo_id_idx on public.combo_notes (combo_id);


-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

create table public.sessions (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    name        text not null check (length(trim(name)) > 0),
    planned_for timestamptz,
    created_at  timestamptz not null default now()
);

comment on table public.sessions is 'A planned set / setlist.';

create index sessions_user_id_planned_for_idx on public.sessions (user_id, planned_for desc nulls last);


-- ---------------------------------------------------------------------------
-- session_tracks
-- ---------------------------------------------------------------------------

create table public.session_tracks (
    id         uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions (id) on delete cascade,
    track_id   uuid not null references public.tracks (id) on delete cascade,
    position   integer not null check (position >= 0),
    created_at timestamptz not null default now(),

    -- Deferrable so the planner can reorder a setlist with plain UPDATEs inside one
    -- transaction without tripping over intermediate duplicate positions.
    -- A surrogate id (rather than a composite PK) lets the same track appear twice
    -- in a set at different positions.
    constraint session_tracks_position_unique unique (session_id, position)
        deferrable initially immediate
);

create index session_tracks_session_id_position_idx on public.session_tracks (session_id, position);
create index session_tracks_track_id_idx on public.session_tracks (track_id);


-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger audio_features_set_updated_at
    before update on public.audio_features
    for each row execute function public.set_updated_at();
