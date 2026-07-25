-- Xfade v1 — audio file storage.
-- Build spec §1: the design doc's `Blob` layer maps to Supabase Storage.
--
-- Private bucket. Objects are keyed "<user_id>/<track_id>.<ext>"; the policies
-- below key off that first path segment, so the layout is load-bearing — the
-- upload endpoint must not change it without changing these policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'tracks',
    'tracks',
    false,
    104857600,  -- 100 MiB
    array[
        'audio/mpeg',
        'audio/mp3',
        'audio/mp4',
        'audio/aac',
        'audio/flac',
        'audio/x-flac',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/aiff',
        'audio/x-aiff'
    ]
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;


create policy tracks_objects_select_own on storage.objects
    for select to authenticated
    using (
        bucket_id = 'tracks'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy tracks_objects_insert_own on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'tracks'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy tracks_objects_update_own on storage.objects
    for update to authenticated
    using (
        bucket_id = 'tracks'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
        bucket_id = 'tracks'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy tracks_objects_delete_own on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'tracks'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );
