/**
 * Hand-written mirrors of the backend's response models.
 *
 * `npm run types:api` regenerates the full OpenAPI surface into `api.ts` from a
 * running backend; these are the narrow, ergonomic shapes the views actually use.
 * If the two disagree, the backend is right.
 */

export type ExtractionStatus = "pending" | "processing" | "complete" | "failed";

export interface AudioFeatures {
  track_id: string;
  status: ExtractionStatus;
  bpm: number | null;
  key_camelot: string | null;
  energy: number | null;
  danceability: number | null;
  duration_seconds: number | null;

  /** From the file's own tags, not derived. Kept so disagreements stay visible. */
  bpm_tag: number | null;
  key_camelot_tag: string | null;

  /** What scoring uses: the tag when present, otherwise the analysis. */
  bpm_effective: number | null;
  key_camelot_effective: string | null;

  structure_markers: Record<string, unknown> | null;
  error_message: string | null;
  analyzed_at: string | null;
}

export interface TrackDetail {
  id: string;
  user_id: string;
  title: string;
  artist: string | null;
  /** From the file's ID3 tag where present, otherwise typed in. Never derived. */
  genre: string | null;
  file_ref: string | null;
  source: string;
  created_at: string;
  audio_features: AudioFeatures | null;
}

export interface ComboNote {
  id: string;
  combo_id: string;
  text: string;
  created_at: string;
}

export interface ComboCreate {
  track_a_id: string;
  track_b_id: string;
  technique?: string | null;
  rating?: number | null;
  notes?: string[];
}

export interface ComboRead {
  id: string;
  user_id: string;
  track_a_id: string;
  track_b_id: string;
  technique: string | null;
  rating: number | null;
  logged_at: string;
  notes: ComboNote[];
}

export interface SessionTrackRead {
  id: string;
  session_id: string;
  track_id: string;
  position: number;
}

export interface SessionRead {
  id: string;
  user_id: string;
  name: string;
  planned_for: string | null;
  created_at: string;
  tracks: SessionTrackRead[];
}

export interface SessionCreate {
  name: string;
  planned_for?: string | null;
}

export type CompatibilityStatus =
  | "ok"
  | "pending_extraction"
  | "extraction_failed"
  | "missing_features";

export interface HarmonicDetail {
  score: number;
  relation: string;
  track_a_key: string;
  track_b_key: string;
}

export interface TempoDetail {
  score: number;
  track_a_bpm: number;
  track_b_bpm: number;
  delta_bpm: number;
  delta_percent: number;
  double_time: boolean;
}

/** One ranked suggestion from `GET /tracks/{id}/compatible`. */
export interface CompatibleTrack {
  track: TrackDetail;
  score: number;
  harmonic: HarmonicDetail;
  tempo: TempoDetail;
  notes: string[];
}

export interface CompatibilityRead {
  track_a_id: string;
  track_b_id: string;
  status: CompatibilityStatus;
  score: number | null;
  harmonic: {
    score: number;
    relation: string;
    track_a_key: string;
    track_b_key: string;
  } | null;
  tempo: {
    score: number;
    track_a_bpm: number;
    track_b_bpm: number;
    delta_bpm: number;
    delta_percent: number;
    double_time: boolean;
  } | null;
  notes: string[];
}
