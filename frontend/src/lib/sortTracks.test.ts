import { describe, expect, it } from "vitest";
import { sortTracks } from "./sortTracks";
import type { TrackDetail } from "../types/xfade";

function track(
  title: string,
  features?: Partial<NonNullable<TrackDetail["audio_features"]>>,
): TrackDetail {
  return {
    id: title,
    user_id: "u",
    title,
    artist: null,
    genre: null,
    file_ref: null,
    source: "upload",
    created_at: "2026-07-25T12:00:00Z",
    audio_features: features
      ? {
          track_id: title,
          status: "complete",
          bpm: null,
          key_camelot: null,
          energy: null,
          danceability: null,
          duration_seconds: null,
          bpm_tag: null,
          key_camelot_tag: null,
          bpm_effective: null,
          key_camelot_effective: null,
          structure_markers: null,
          error_message: null,
          analyzed_at: null,
          ...features,
        }
      : null,
  };
}

const titles = (tracks: TrackDetail[]) => tracks.map((t) => t.title);

describe("sortTracks", () => {
  it("sorts by BPM in both directions", () => {
    const tracks = [track("slow", { bpm: 90 }), track("fast", { bpm: 174 }), track("mid", { bpm: 128 })];

    expect(titles(sortTracks(tracks, "bpm", "asc"))).toEqual(["slow", "mid", "fast"]);
    expect(titles(sortTracks(tracks, "bpm", "desc"))).toEqual(["fast", "mid", "slow"]);
  });

  it("does not mutate the input", () => {
    const tracks = [track("b", { bpm: 2 }), track("a", { bpm: 1 })];
    sortTracks(tracks, "bpm", "asc");
    expect(titles(tracks)).toEqual(["b", "a"]);
  });

  it("orders keys around the wheel, not alphabetically", () => {
    // As strings, "10A" sorts between "1A" and "2A", scattering neighbouring keys.
    const tracks = [
      track("ten", { key_camelot: "10A" }),
      track("one", { key_camelot: "1A" }),
      track("two", { key_camelot: "2A" }),
    ];

    expect(titles(sortTracks(tracks, "key_camelot", "asc"))).toEqual(["one", "two", "ten"]);
  });

  it("keeps A and B of the same number adjacent", () => {
    const tracks = [
      track("8B", { key_camelot: "8B" }),
      track("9A", { key_camelot: "9A" }),
      track("8A", { key_camelot: "8A" }),
    ];

    expect(titles(sortTracks(tracks, "key_camelot", "asc"))).toEqual(["8A", "8B", "9A"]);
  });

  it("puts tracks without features last in both directions", () => {
    // A fresh upload has no BPM yet. It should never displace analysed rows.
    const tracks = [track("pending"), track("analysed", { bpm: 128 })];

    expect(titles(sortTracks(tracks, "bpm", "asc"))).toEqual(["analysed", "pending"]);
    expect(titles(sortTracks(tracks, "bpm", "desc"))).toEqual(["analysed", "pending"]);
  });

  it("treats an unparseable key as missing", () => {
    const tracks = [track("bad", { key_camelot: "wat" }), track("good", { key_camelot: "5A" })];
    expect(titles(sortTracks(tracks, "key_camelot", "asc"))).toEqual(["good", "bad"]);
  });

  it("sorts titles case-insensitively", () => {
    const tracks = [track("zebra"), track("Apple"), track("mango")];
    expect(titles(sortTracks(tracks, "title", "asc"))).toEqual(["Apple", "mango", "zebra"]);
  });

  it("sorts by artist, with missing artists last", () => {
    const tracks: TrackDetail[] = [
      { ...track("no-artist"), artist: null },
      { ...track("has-artist"), artist: "Aphex Twin" },
    ];
    expect(titles(sortTracks(tracks, "artist", "asc"))).toEqual(["has-artist", "no-artist"]);
  });
});
