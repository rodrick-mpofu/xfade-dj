import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { SessionCreate, SessionRead } from "../types/xfade";

export function useSessions() {
  return useQuery({ queryKey: ["sessions"], queryFn: api.listSessions });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ["sessions", id],
    queryFn: () => api.getSession(id!),
    enabled: Boolean(id),
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (session: SessionCreate) => api.createSession(session),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.deleteSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useAddSessionTrack(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trackId: string) => api.addSessionTrack(sessionId, trackId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] }),
  });
}

/**
 * Reorder and remove both go through the backend's atomic replace.
 *
 * Applied optimistically: dragging a track down a setlist should feel immediate,
 * and waiting a round trip per click makes reordering feel broken. If the write
 * fails the previous order is put back, so the UI never silently disagrees with
 * the database.
 */
export function useReplaceSessionTracks(sessionId: string) {
  const queryClient = useQueryClient();
  const key = ["sessions", sessionId];

  return useMutation({
    mutationFn: (trackIds: string[]) => api.replaceSessionTracks(sessionId, trackIds),

    onMutate: async (trackIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SessionRead>(key);

      if (previous) {
        queryClient.setQueryData<SessionRead>(key, {
          ...previous,
          tracks: trackIds.map((trackId, index) => ({
            id: `optimistic-${index}`,
            session_id: sessionId,
            track_id: trackId,
            position: index,
          })),
        });
      }
      return { previous };
    },

    onError: (_error, _trackIds, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/**
 * Compatibility for each adjacent pair in the setlist (build spec §6).
 *
 * One query per pair, in parallel and individually cached — so reordering a set
 * mostly re-uses scores it already has rather than refetching the whole chain.
 */
export function useAdjacentCompatibility(trackIds: string[]) {
  const pairs = trackIds.slice(0, -1).map((trackId, index) => [trackId, trackIds[index + 1]!]);

  return useQueries({
    queries: pairs.map(([a, b]) => ({
      queryKey: ["compatibility", a, b],
      queryFn: () => api.getCompatibility(a!, b!),
      // A track can legitimately repeat in a set; the backend refuses to score a
      // pair with itself, so do not ask.
      enabled: a !== b,
      staleTime: 5 * 60_000,
    })),
  });
}
