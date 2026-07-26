-- Keep both opinions about a track's BPM and key.
--
-- The audio files carry BPM and key in their ID3 tags, written by Serato or by the
-- pool a track came from. Measured across 13 real tracks: tag and Essentia BPM agreed
-- 13/13, while the key disagreed on 5 — and twice badly enough to read as a "clash"
-- between tracks that actually share a tonic.
--
-- So the tag values are stored next to the derived ones rather than replacing them.
-- Scoring prefers the tag where one exists; keeping both means a disagreement stays
-- visible and reviewable instead of being silently resolved. It also keeps the
-- extraction pipeline honest — it remains the only source for the ~28% of a library
-- with no key tag, and for anything unreleased.

alter table public.audio_features
    add column bpm_tag real check (bpm_tag > 0 and bpm_tag < 400),
    add column key_camelot_tag text check (key_camelot_tag ~ '^(1[0-2]|[1-9])[AB]$');

comment on column public.audio_features.bpm_tag is
    'BPM from the file''s tags. Not derived — compare against bpm.';
comment on column public.audio_features.key_camelot_tag is
    'Key from the file''s tags, mapped to Camelot. Not derived — compare against key_camelot.';

-- Which value wins is a property of the data, not something each caller re-decides.
-- Generated columns make that rule impossible to apply inconsistently.
alter table public.audio_features
    add column bpm_effective real
        generated always as (coalesce(bpm_tag, bpm)) stored,
    add column key_camelot_effective text
        generated always as (coalesce(key_camelot_tag, key_camelot)) stored;

comment on column public.audio_features.key_camelot_effective is
    'What scoring uses: the tag when present, otherwise Essentia''s answer.';

comment on table public.audio_features is
    'What is known about a track''s audio — derived by extraction, and read from the file''s own tags. Both are kept so they can be compared.';
