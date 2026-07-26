import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { TrackDetail } from "../types/xfade";

/** How often to re-check a library that has extractions in flight. */
const POLL_INTERVAL_MS = 3000;

const isInFlight = (track: TrackDetail) =>
  track.audio_features?.status === "pending" || track.audio_features?.status === "processing";

export function useTracks() {
  return useQuery({
    queryKey: ["tracks"],
    queryFn: api.listTracks,
    // Extraction is a background job with no push channel, so the table polls —
    // but only while something is actually being analysed. An idle library makes
    // no requests at all.
    refetchInterval: (query) =>
      (query.state.data ?? []).some(isInFlight) ? POLL_INTERVAL_MS : false,
  });
}

export function useTrack(id: string | undefined) {
  return useQuery({
    queryKey: ["tracks", id],
    queryFn: () => api.getTrack(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data && isInFlight(query.state.data) ? POLL_INTERVAL_MS : false),
  });
}

export function useTrackCombos(trackId: string | undefined) {
  return useQuery({
    queryKey: ["combos", { trackId }],
    queryFn: () => api.listCombos(trackId),
    enabled: Boolean(trackId),
  });
}

export function useDeleteTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trackId: string) => api.deleteTrack(trackId),
    onSuccess: () => {
      // Combos and setlists cascade in the database, so their caches are stale too.
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["combos"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useRetryExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trackId: string) => api.retryExtraction(trackId),
    onSuccess: (_data, trackId) => {
      // Back to `pending`, which turns the polling in useTrack/useTracks back on.
      queryClient.invalidateQueries({ queryKey: ["tracks", trackId] });
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
}

export function useDeleteCombo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (comboId: string) => api.deleteCombo(comboId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["combos"] }),
  });
}

export function useUploadTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, title, artist }: { file: File; title: string; artist?: string }) =>
      api.uploadTrack(file, title, artist),
    onSuccess: () => {
      // The new row arrives as `pending`, which turns the poll back on.
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
}
