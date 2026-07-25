import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdjacentScore } from "../components/AdjacentScore";
import { TrackPicker } from "../components/TrackPicker";
import {
  useAddSessionTrack,
  useAdjacentCompatibility,
  useReplaceSessionTracks,
  useSession,
} from "../hooks/useSessions";
import { moveItem, removeAt } from "../lib/reorder";
import { useTracks } from "../hooks/useTracks";
import type { TrackDetail } from "../types/xfade";

export function SessionPlanner() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data: session, isPending, isError, error } = useSession(sessionId);
  const { data: library } = useTracks();
  const [adding, setAdding] = useState(false);

  const addTrack = useAddSessionTrack(sessionId!);
  const replaceTracks = useReplaceSessionTracks(sessionId!);

  const ordered = useMemo(
    () => [...(session?.tracks ?? [])].sort((a, b) => a.position - b.position),
    [session],
  );
  const trackIds = ordered.map((entry) => entry.track_id);

  const byId = useMemo(
    () => new Map((library ?? []).map((track) => [track.id, track])),
    [library],
  );

  const scores = useAdjacentCompatibility(trackIds);

  if (isPending) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (isError) {
    return (
      <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
        {(error as Error).message}
      </p>
    );
  }

  const apply = (next: string[]) => {
    if (next !== trackIds) replaceTracks.mutate(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/sessions" className="text-sm text-sky-700 hover:underline dark:text-sky-400">
          ← Sessions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{session.name}</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {ordered.length} track{ordered.length === 1 ? "" : "s"}
          {session.planned_for && ` · ${new Date(session.planned_for).toLocaleString()}`}
        </p>
      </div>

      {replaceTracks.isError && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          Could not save the new order: {(replaceTracks.error as Error).message}
        </p>
      )}

      {ordered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500 dark:border-neutral-700">
          Empty setlist. Add a track to start planning.
        </p>
      ) : (
        <ol className="space-y-1">
          {ordered.map((entry, index) => {
            const track: TrackDetail | undefined = byId.get(entry.track_id);
            const features = track?.audio_features;
            const score = scores[index];

            return (
              <li key={entry.id}>
                <div className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                  <span className="w-5 text-right text-sm tabular-nums text-neutral-400">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{track?.title ?? "Unknown track"}</span>
                    <span className="ml-2 text-sm text-neutral-500">{track?.artist ?? ""}</span>
                  </span>
                  {features?.key_camelot && (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">
                      {features.key_camelot}
                    </span>
                  )}
                  {features?.bpm != null && (
                    <span className="text-xs tabular-nums text-neutral-500">
                      {features.bpm.toFixed(0)} BPM
                    </span>
                  )}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move ${track?.title ?? "track"} up`}
                      disabled={index === 0}
                      onClick={() => apply(moveItem(trackIds, index, index - 1))}
                      className="rounded px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${track?.title ?? "track"} down`}
                      disabled={index === ordered.length - 1}
                      onClick={() => apply(moveItem(trackIds, index, index + 1))}
                      className="rounded px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${track?.title ?? "track"}`}
                      onClick={() => apply(removeAt(trackIds, index))}
                      className="rounded px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {index < ordered.length - 1 && (
                  <AdjacentScore
                    data={score?.data}
                    isPending={score?.isPending ?? false}
                    isSameTrack={entry.track_id === ordered[index + 1]?.track_id}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {adding ? (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <TrackPicker
            label="Add a track"
            tracks={library ?? []}
            selected={null}
            onSelect={(track) => {
              if (track) addTrack.mutate(track.id);
              setAdding(false);
            }}
          />
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="mt-3 rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Add track
        </button>
      )}
    </div>
  );
}
