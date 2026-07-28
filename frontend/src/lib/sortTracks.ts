import { bpmOf, keyOf } from "./features";
import type { TrackDetail } from "../types/xfade";

export type SortKey =
  | "title"
  | "artist"
  | "bpm"
  | "key_camelot"
  | "genre"
  | "duration"
  | "energy"
  | "created_at";
export type SortDirection = "asc" | "desc";

/**
 * Pure so the Library table's ordering is testable without rendering anything.
 *
 * Tracks awaiting extraction have no BPM or key. They sort last in both directions
 * rather than clumping at the top of a descending sort, so a fresh upload never
 * displaces the rows you were actually looking at.
 */
export function sortTracks(
  tracks: TrackDetail[],
  key: SortKey,
  direction: SortDirection,
): TrackDetail[] {
  const factor = direction === "asc" ? 1 : -1;

  return [...tracks].sort((a, b) => {
    const left = valueFor(a, key);
    const right = valueFor(b, key);

    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;

    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }
    return String(left).localeCompare(String(right), undefined, { sensitivity: "base" }) * factor;
  });
}

function valueFor(track: TrackDetail, key: SortKey): string | number | null {
  switch (key) {
    case "title":
      return track.title;
    case "artist":
      return track.artist;
    case "created_at":
      return track.created_at;
    case "genre":
      return track.genre;
    case "bpm":
      return bpmOf(track.audio_features);
    case "duration":
      return track.audio_features?.duration_seconds ?? null;
    case "energy":
      // No effective/tag pair for energy — nothing writes it but extraction.
      return track.audio_features?.energy ?? null;
    case "key_camelot":
      // Sorts on the same value the table shows and the scorer uses.
      return camelotOrder(keyOf(track.audio_features));
  }
}

/**
 * Sort keys around the wheel (1A, 1B, 2A, ...) rather than as strings, where "10A"
 * would land between "1A" and "2A" and neighbouring keys would scatter. Grouping
 * compatible keys together is the whole reason to sort by key.
 */
function camelotOrder(code: string | null): number | null {
  if (!code) return null;
  const match = /^(\d{1,2})([AB])$/.exec(code.toUpperCase());
  if (!match) return null;
  return Number(match[1]) * 2 + (match[2] === "B" ? 1 : 0);
}
