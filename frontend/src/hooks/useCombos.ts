import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ComboCreate, ComboUpdate } from "../types/xfade";

const POLL_INTERVAL_MS = 3000;

/**
 * Score for a pair, fetched as soon as both tracks are chosen (build spec §6: the
 * score should surface live while selecting, not after logging).
 *
 * Keeps polling while either track is still being analysed, so picking a fresh
 * upload shows a score the moment extraction lands rather than requiring a reload.
 */
export function useCompatibility(trackA: string | null, trackB: string | null) {
  const enabled = Boolean(trackA && trackB && trackA !== trackB);

  return useQuery({
    queryKey: ["compatibility", trackA, trackB],
    queryFn: () => api.getCompatibility(trackA!, trackB!),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.status === "pending_extraction" ? POLL_INTERVAL_MS : false,
  });
}

/** Every logged combo, newest first (the backend orders by logged_at). */
export function useCombos() {
  return useQuery({ queryKey: ["combos", { trackId: undefined }], queryFn: () => api.listCombos() });
}

/**
 * Suggestions for one track. Kept fresh for a while because the answer only
 * changes when the library does, and re-scoring on every focus would be wasteful.
 */
export function useCompatibleTracks(trackId: string | null) {
  return useQuery({
    queryKey: ["compatible", trackId],
    queryFn: () => api.getCompatibleTracks(trackId!),
    enabled: Boolean(trackId),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * Correct a logged combo's rating or technique.
 *
 * No optimistic update on purpose: the whole point of editing is that the stored
 * value was wrong, and showing the new one before the write lands would be the same
 * failure again. It refetches and shows what the database actually holds.
 */
export function useUpdateCombo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ComboUpdate }) =>
      api.updateCombo(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["combos"] }),
  });
}

export function useCreateCombo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (combo: ComboCreate) => api.createCombo(combo),
    onSuccess: () => {
      // Track detail lists the combos a track appears in, so those go stale too.
      queryClient.invalidateQueries({ queryKey: ["combos"] });
    },
  });
}
