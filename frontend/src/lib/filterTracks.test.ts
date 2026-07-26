import { describe, expect, it } from "vitest";
import { MAX_SUGGESTIONS, filterTracks } from "./filterTracks";
import type { TrackDetail } from "../types/xfade";

function track(title: string, artist: string | null = null, key: string | null = null): TrackDetail {
  return {
    id: title,
    user_id: "u",
    title,
    artist,
    genre: null,
    file_ref: null,
    source: "upload",
    created_at: "2026-07-25T12:00:00Z",
    audio_features: key
      ? {
          track_id: title,
          status: "complete",
          bpm: 128,
          key_camelot: key,
          energy: null,
          danceability: null,
          duration_seconds: null,
          structure_markers: null,
          error_message: null,
          analyzed_at: null,
        }
      : null,
  };
}

const titles = (tracks: TrackDetail[]) => tracks.map((t) => t.title);

const library = [
  track("Windowlicker", "Aphex Twin", "8A"),
  track("Come to Daddy", "Aphex Twin", "8B"),
  track("Windowpane", "Opeth", "3A"),
];

describe("filterTracks", () => {
  it("returns everything for an empty query", () => {
    expect(filterTracks(library, "")).toHaveLength(3);
  });

  it("ignores a whitespace-only query", () => {
    expect(filterTracks(library, "   ")).toHaveLength(3);
  });

  it("matches on title, case-insensitively", () => {
    expect(titles(filterTracks(library, "WINDOWLICKER"))).toEqual(["Windowlicker"]);
  });

  it("matches on artist", () => {
    expect(titles(filterTracks(library, "aphex"))).toEqual(["Windowlicker", "Come to Daddy"]);
  });

  it("matches on Camelot key", () => {
    expect(titles(filterTracks(library, "3a"))).toEqual(["Windowpane"]);
  });

  it("narrows with each additional term rather than widening", () => {
    // "aphex 8b" should mean both, not either.
    expect(titles(filterTracks(library, "aphex 8b"))).toEqual(["Come to Daddy"]);
  });

  it("returns nothing when a term matches nothing", () => {
    expect(filterTracks(library, "aphex opeth")).toEqual([]);
  });

  it("matches partial words", () => {
    expect(titles(filterTracks(library, "window"))).toEqual(["Windowlicker", "Windowpane"]);
  });

  it("tolerates tracks with no artist or features", () => {
    expect(titles(filterTracks([track("Bare")], "bare"))).toEqual(["Bare"]);
  });

  it("caps how many suggestions it returns", () => {
    const many = Array.from({ length: 200 }, (_, i) => track(`Track ${i}`));
    expect(filterTracks(many, "track")).toHaveLength(MAX_SUGGESTIONS);
    expect(filterTracks(many, "")).toHaveLength(MAX_SUGGESTIONS);
  });
});
