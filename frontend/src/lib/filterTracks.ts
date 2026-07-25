import type { TrackDetail } from "../types/xfade";

/** Cap on rendered options — a long library should not paint hundreds of rows per keystroke. */
export const MAX_SUGGESTIONS = 40;

/**
 * Title/artist/key substring match, case-insensitive.
 *
 * Pure so the picker's matching is testable without a DOM. Every term must match
 * somewhere, so "aphex 8a" narrows rather than widening — the useful behaviour when
 * hunting for a specific track mid-set.
 */
export function filterTracks(tracks: TrackDetail[], query: string): TrackDetail[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return tracks.slice(0, MAX_SUGGESTIONS);

  return tracks
    .filter((track) => {
      const haystack = [track.title, track.artist ?? "", track.audio_features?.key_camelot ?? ""]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, MAX_SUGGESTIONS);
}
