import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ComboCreate } from "../types/xfade";

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
