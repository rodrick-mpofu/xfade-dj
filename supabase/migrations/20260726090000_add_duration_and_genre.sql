-- Duration and genre.
--
-- Duration is derived from the audio, so it belongs with the extracted features.
-- Genre is not derivable in any trustworthy way — Essentia can guess, badly — so it
-- lives on the track as metadata, read from the file's tags or typed in.

alter table public.tracks
    add column genre text;

comment on column public.tracks.genre is
    'From the file''s ID3 tag where present, otherwise user-supplied. Not derived from audio.';

alter table public.audio_features
    add column duration_seconds real check (duration_seconds > 0);

-- Extraction has been recording duration inside structure_markers all along, so
-- existing rows can be backfilled rather than re-analysed.
update public.audio_features
set duration_seconds = (structure_markers ->> 'duration_seconds')::real
where duration_seconds is null
  and structure_markers ? 'duration_seconds'
  and (structure_markers ->> 'duration_seconds')::real > 0;
