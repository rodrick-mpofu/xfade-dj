import { supabase } from "./supabase";
import type {
  ComboCreate,
  ComboRead,
  CompatibilityRead,
  SessionCreate,
  SessionRead,
  SessionTrackRead,
  TrackDetail,
} from "../types/xfade";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ApiError(401, "Not signed in.");
  }
  return { Authorization: `Bearer ${token}` };
}

/** Pull FastAPI's `detail` out so the UI shows the real reason, not "Request failed". */
async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      // 422s come back as a list of per-field validation errors.
      return body.detail.map((d: { msg?: string }) => d.msg ?? "invalid").join("; ");
    }
  } catch {
    // Fall through to the status text.
  }
  return response.statusText || `Request failed with ${response.status}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(await authHeader()), ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  listTracks: () => request<TrackDetail[]>("/tracks"),

  getTrack: (id: string) => request<TrackDetail>(`/tracks/${id}`),

  uploadTrack: (file: File, title: string, artist?: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    if (artist) form.append("artist", artist);
    // No Content-Type header: the browser must set the multipart boundary itself.
    return request<TrackDetail>("/tracks", { method: "POST", body: form });
  },

  listCombos: (trackId?: string) =>
    request<ComboRead[]>(`/combos${trackId ? `?track_id=${trackId}` : ""}`),

  createCombo: (combo: ComboCreate) =>
    request<ComboRead>("/combos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(combo),
    }),

  getCompatibility: (trackA: string, trackB: string) =>
    request<CompatibilityRead>(`/compatibility?track_a=${trackA}&track_b=${trackB}`),

  listSessions: () => request<SessionRead[]>("/sessions"),

  getSession: (id: string) => request<SessionRead>(`/sessions/${id}`),

  createSession: (session: SessionCreate) =>
    request<SessionRead>("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    }),

  addSessionTrack: (sessionId: string, trackId: string) =>
    request<SessionTrackRead>(`/sessions/${sessionId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_id: trackId }),
    }),

  /** Replaces the whole ordered setlist — one call covers reorder and remove. */
  replaceSessionTracks: (sessionId: string, trackIds: string[]) =>
    request<SessionTrackRead[]>(`/sessions/${sessionId}/tracks`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: trackIds }),
    }),
};
