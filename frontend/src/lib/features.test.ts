import { describe, expect, it } from "vitest";
import { bpmOf, keyOf, keysDisagree } from "./features";
import type { AudioFeatures } from "../types/xfade";

function features(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    track_id: "t",
    status: "complete",
    bpm: 128,
    key_camelot: "8A",
    bpm_tag: null,
    key_camelot_tag: null,
    bpm_effective: null,
    key_camelot_effective: null,
    energy: null,
    danceability: null,
    duration_seconds: null,
    structure_markers: null,
    error_message: null,
    analyzed_at: null,
    ...overrides,
  };
}

describe("keyOf / bpmOf", () => {
  it("uses the effective value the backend resolved", () => {
    const f = features({ key_camelot: "8A", key_camelot_tag: "6A", key_camelot_effective: "6A" });
    expect(keyOf(f)).toBe("6A");
  });

  it("falls back to the analysed value when there is no effective column", () => {
    // Older cached responses predate the tag columns; the table should still render.
    expect(keyOf(features())).toBe("8A");
    expect(bpmOf(features())).toBe(128);
  });

  it("returns null when nothing is known", () => {
    const f = features({ bpm: null, key_camelot: null });
    expect(keyOf(f)).toBeNull();
    expect(bpmOf(f)).toBeNull();
  });

  it("handles a missing feature row", () => {
    expect(keyOf(null)).toBeNull();
    expect(bpmOf(undefined)).toBeNull();
  });

  it("does not treat a zero BPM as missing by accident", () => {
    // ?? rather than || matters here: 0 is falsy but is a real (if invalid) reading.
    expect(bpmOf(features({ bpm_effective: 0 }))).toBe(0);
  });
});

describe("keysDisagree", () => {
  it("is true when analysis and the tag differ", () => {
    expect(keysDisagree(features({ key_camelot: "5A", key_camelot_tag: "6A" }))).toBe(true);
  });

  it("is false when they agree", () => {
    expect(keysDisagree(features({ key_camelot: "6A", key_camelot_tag: "6A" }))).toBe(false);
  });

  it("is false when either side is missing", () => {
    // Absence is not disagreement — most files have no key tag at all.
    expect(keysDisagree(features({ key_camelot_tag: null }))).toBe(false);
    expect(keysDisagree(features({ key_camelot: null, key_camelot_tag: "6A" }))).toBe(false);
    expect(keysDisagree(null)).toBe(false);
  });
});
