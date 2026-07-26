import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdjacentScore } from "../components/AdjacentScore";
import { TrackPicker } from "../components/TrackPicker";
import { Button } from "../components/ui/Button";
import { EmptyState, Panel } from "../components/ui/Panel";
import { Pill } from "../components/ui/Pill";
import {
  useAddSessionTrack,
  useAdjacentCompatibility,
  useReplaceSessionTracks,
  useSession,
} from "../hooks/useSessions";
import { useTracks } from "../hooks/useTracks";
import { bpmOf, keyOf } from "../lib/features";
import { moveItem, removeAt } from "../lib/reorder";
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

  if (isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (isError) {
    return (
      <p role="alert" className="rounded-lg bg-rose-950/40 p-4 text-sm text-rose-300">
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
        <Link to="/sessions" className="text-sm text-accent hover:underline">
          ← Sessions
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{session.name}</h1>
        <p className="text-sm text-muted">
          {ordered.length} track{ordered.length === 1 ? "" : "s"}
          {session.planned_for && ` · ${new Date(session.planned_for).toLocaleString()}`}
        </p>
      </div>

      {replaceTracks.isError && (
        <p role="alert" className="text-sm text-rose-400">
          Could not save the new order: {(replaceTracks.error as Error).message}
        </p>
      )}

      {ordered.length === 0 ? (
        <EmptyState>Empty setlist. Add a track to start planning.</EmptyState>
      ) : (
        <ol>
          {ordered.map((entry, index) => {
            const track: TrackDetail | undefined = byId.get(entry.track_id);
            const features = track?.audio_features;
            const score = scores[index];

            return (
              <li key={entry.id}>
                <Panel className="flex items-center gap-3 px-3 py-2.5">
                  <span className="data w-6 text-right text-sm text-muted">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{track?.title ?? "Unknown track"}</span>
                    <span className="ml-2 text-sm text-muted">{track?.artist ?? ""}</span>
                  </span>
                  {keyOf(features) && <Pill tone="key">{keyOf(features)}</Pill>}
                  {bpmOf(features) != null && (
                    <span className="data text-xs text-accent">{bpmOf(features)!.toFixed(0)}</span>
                  )}
                  <div className="flex items-center gap-0.5 text-muted">
                    <button
                      type="button"
                      aria-label={`Move ${track?.title ?? "track"} up`}
                      disabled={index === 0}
                      onClick={() => apply(moveItem(trackIds, index, index - 1))}
                      className="rounded px-2 py-1 text-sm transition hover:bg-raise hover:text-text disabled:opacity-25"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${track?.title ?? "track"} down`}
                      disabled={index === ordered.length - 1}
                      onClick={() => apply(moveItem(trackIds, index, index + 1))}
                      className="rounded px-2 py-1 text-sm transition hover:bg-raise hover:text-text disabled:opacity-25"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${track?.title ?? "track"}`}
                      onClick={() => apply(removeAt(trackIds, index))}
                      className="rounded px-2 py-1 text-sm transition hover:bg-raise hover:text-text"
                    >
                      ✕
                    </button>
                  </div>
                </Panel>

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
        <Panel className="p-4">
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
            className="mt-3 rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-raise hover:text-text"
          >
            Cancel
          </button>
        </Panel>
      ) : (
        <Button variant="primary" onClick={() => setAdding(true)} className="py-2">
          + Add track
        </Button>
      )}
    </div>
  );
}
