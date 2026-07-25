-- Xfade v1 — atomic setlist replacement.
--
-- The session planner (build spec §6) reorders a setlist by drag-and-drop, which
-- is a "replace the whole ordered list" operation. Done over PostgREST that is a
-- DELETE followed by an INSERT: two round trips, no transaction, and a failure
-- between them leaves the user's curated setlist empty. Doing it in one function
-- makes it atomic, and lets the deferrable unique(session_id, position)
-- constraint from the init migration do its job.
--
-- SECURITY INVOKER on purpose: the function runs as the caller, so the existing
-- RLS policies still decide what it may touch. In particular the session_tracks
-- insert policy re-checks that every referenced track belongs to the caller, so
-- this cannot be used to smuggle another user's track into a setlist.

create or replace function public.set_session_tracks(
    p_session_id uuid,
    p_track_ids uuid[]
)
returns setof public.session_tracks
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- RLS hides other users' sessions, so "not visible" and "does not exist" are
    -- the same answer here, which is what we want.
    if not exists (select 1 from public.sessions s where s.id = p_session_id) then
        raise exception 'Session % not found', p_session_id
            using errcode = 'no_data_found';
    end if;

    delete from public.session_tracks where session_id = p_session_id;

    -- An empty array is a legitimate request: it clears the setlist.
    return query
    with inserted as (
        insert into public.session_tracks (session_id, track_id, position)
        select p_session_id, entry.track_id, entry.ordinality - 1
        from unnest(p_track_ids) with ordinality as entry(track_id, ordinality)
        returning *
    )
    select * from inserted order by position;
end;
$$;

comment on function public.set_session_tracks(uuid, uuid[]) is
    'Replace a session''s tracks with the given ordered list, atomically.';

grant execute on function public.set_session_tracks(uuid, uuid[]) to authenticated;
