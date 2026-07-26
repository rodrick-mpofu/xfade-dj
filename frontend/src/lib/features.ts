import type { AudioFeatures } from "../types/xfade";

/**
 * Reading a track's BPM and key.
 *
 * Two sources exist: what extraction derived, and what the file's own tags claim.
 * The backend resolves them into `*_effective` columns (tag first), and everything
 * user-facing should read those — otherwise the table and the score would disagree
 * with each other.
 *
 * The fallbacks matter for older cached responses that predate the tag columns.
 */

export function keyOf(features: AudioFeatures | null | undefined): string | null {
  return features?.key_camelot_effective ?? features?.key_camelot ?? null;
}

export function bpmOf(features: AudioFeatures | null | undefined): number | null {
  return features?.bpm_effective ?? features?.bpm ?? null;
}

/**
 * True when analysis and the file's tags name different keys.
 *
 * Worth surfacing rather than hiding: it is the only signal that the pipeline got
 * one wrong, and across a real library it happens to roughly one track in six.
 */
export function keysDisagree(features: AudioFeatures | null | undefined): boolean {
  const derived = features?.key_camelot;
  const tagged = features?.key_camelot_tag;
  return Boolean(derived && tagged && derived !== tagged);
}
