-- Xfade v1 — row-level security.
-- Build spec §4: every table scoped to user_id = auth.uid(), even single-user.
--
-- Two access patterns exist in the backend:
--   * request-scoped client, carrying the caller's JWT  -> these policies apply
--   * service-role client, used only by the extraction job -> bypasses RLS
--
-- `(select auth.uid())` rather than a bare `auth.uid()` — the subquery form is
-- evaluated once per statement instead of once per row.
--
-- Child tables (audio_features, combo_notes, session_tracks) have no user_id of
-- their own; ownership is derived from the parent row.

-- ---------------------------------------------------------------------------
-- tracks
-- ---------------------------------------------------------------------------

alter table public.tracks enable row level security;

create policy tracks_select_own on public.tracks
    for select to authenticated
    using (user_id = (select auth.uid()));

create policy tracks_insert_own on public.tracks
    for insert to authenticated
    with check (user_id = (select auth.uid()));

create policy tracks_update_own on public.tracks
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy tracks_delete_own on public.tracks
    for delete to authenticated
    using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- audio_features — ownership via tracks
-- ---------------------------------------------------------------------------

alter table public.audio_features enable row level security;

create policy audio_features_select_own on public.audio_features
    for select to authenticated
    using (
        exists (
            select 1 from public.tracks t
            where t.id = audio_features.track_id
              and t.user_id = (select auth.uid())
        )
    );

create policy audio_features_insert_own on public.audio_features
    for insert to authenticated
    with check (
        exists (
            select 1 from public.tracks t
            where t.id = audio_features.track_id
              and t.user_id = (select auth.uid())
        )
    );

create policy audio_features_update_own on public.audio_features
    for update to authenticated
    using (
        exists (
            select 1 from public.tracks t
            where t.id = audio_features.track_id
              and t.user_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1 from public.tracks t
            where t.id = audio_features.track_id
              and t.user_id = (select auth.uid())
        )
    );

create policy audio_features_delete_own on public.audio_features
    for delete to authenticated
    using (
        exists (
            select 1 from public.tracks t
            where t.id = audio_features.track_id
              and t.user_id = (select auth.uid())
        )
    );


-- ---------------------------------------------------------------------------
-- combos
--
-- Write policies also verify both referenced tracks are the caller's. RLS on
-- `tracks` hides other users' rows from SELECT, but a foreign key to a known id
-- would still insert cleanly without this check.
-- ---------------------------------------------------------------------------

alter table public.combos enable row level security;

create policy combos_select_own on public.combos
    for select to authenticated
    using (user_id = (select auth.uid()));

create policy combos_insert_own on public.combos
    for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and exists (
            select 1 from public.tracks t
            where t.id = combos.track_a_id and t.user_id = (select auth.uid())
        )
        and exists (
            select 1 from public.tracks t
            where t.id = combos.track_b_id and t.user_id = (select auth.uid())
        )
    );

create policy combos_update_own on public.combos
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (
        user_id = (select auth.uid())
        and exists (
            select 1 from public.tracks t
            where t.id = combos.track_a_id and t.user_id = (select auth.uid())
        )
        and exists (
            select 1 from public.tracks t
            where t.id = combos.track_b_id and t.user_id = (select auth.uid())
        )
    );

create policy combos_delete_own on public.combos
    for delete to authenticated
    using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- combo_notes — ownership via combos
-- ---------------------------------------------------------------------------

alter table public.combo_notes enable row level security;

create policy combo_notes_select_own on public.combo_notes
    for select to authenticated
    using (
        exists (
            select 1 from public.combos c
            where c.id = combo_notes.combo_id
              and c.user_id = (select auth.uid())
        )
    );

create policy combo_notes_insert_own on public.combo_notes
    for insert to authenticated
    with check (
        exists (
            select 1 from public.combos c
            where c.id = combo_notes.combo_id
              and c.user_id = (select auth.uid())
        )
    );

create policy combo_notes_update_own on public.combo_notes
    for update to authenticated
    using (
        exists (
            select 1 from public.combos c
            where c.id = combo_notes.combo_id
              and c.user_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1 from public.combos c
            where c.id = combo_notes.combo_id
              and c.user_id = (select auth.uid())
        )
    );

create policy combo_notes_delete_own on public.combo_notes
    for delete to authenticated
    using (
        exists (
            select 1 from public.combos c
            where c.id = combo_notes.combo_id
              and c.user_id = (select auth.uid())
        )
    );


-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

alter table public.sessions enable row level security;

create policy sessions_select_own on public.sessions
    for select to authenticated
    using (user_id = (select auth.uid()));

create policy sessions_insert_own on public.sessions
    for insert to authenticated
    with check (user_id = (select auth.uid()));

create policy sessions_update_own on public.sessions
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy sessions_delete_own on public.sessions
    for delete to authenticated
    using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- session_tracks — ownership via sessions, plus track ownership on write
-- ---------------------------------------------------------------------------

alter table public.session_tracks enable row level security;

create policy session_tracks_select_own on public.session_tracks
    for select to authenticated
    using (
        exists (
            select 1 from public.sessions s
            where s.id = session_tracks.session_id
              and s.user_id = (select auth.uid())
        )
    );

create policy session_tracks_insert_own on public.session_tracks
    for insert to authenticated
    with check (
        exists (
            select 1 from public.sessions s
            where s.id = session_tracks.session_id
              and s.user_id = (select auth.uid())
        )
        and exists (
            select 1 from public.tracks t
            where t.id = session_tracks.track_id
              and t.user_id = (select auth.uid())
        )
    );

create policy session_tracks_update_own on public.session_tracks
    for update to authenticated
    using (
        exists (
            select 1 from public.sessions s
            where s.id = session_tracks.session_id
              and s.user_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1 from public.sessions s
            where s.id = session_tracks.session_id
              and s.user_id = (select auth.uid())
        )
        and exists (
            select 1 from public.tracks t
            where t.id = session_tracks.track_id
              and t.user_id = (select auth.uid())
        )
    );

create policy session_tracks_delete_own on public.session_tracks
    for delete to authenticated
    using (
        exists (
            select 1 from public.sessions s
            where s.id = session_tracks.session_id
              and s.user_id = (select auth.uid())
        )
    );
