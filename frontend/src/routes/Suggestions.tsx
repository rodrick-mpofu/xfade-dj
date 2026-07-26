import { useState } from "react";
import { Link } from "react-router-dom";
import { scoreTone } from "../components/CompatibilityPanel";
import { TrackPicker } from "../components/TrackPicker";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, Panel } from "../components/ui/Panel";
import { Pill } from "../components/ui/Pill";
import { useCompatibleTracks } from "../hooks/useCombos";
import { useTracks } from "../hooks/useTracks";
import type { TrackDetail } from "../types/xfade";

export function Suggestions() {
  const { data: tracks } = useTracks();
  const [source, setSource] = useState<TrackDetail | null>(null);
  const { data: matches, isPending, isError, error } = useCompatibleTracks(source?.id ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Harmonic suggestions"
        subtitle="Pick a track and see what mixes well with it, scored on the Camelot wheel and tempo."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="space-y-4">
          <TrackPicker
            label="Mixing out of"
            tracks={tracks ?? []}
            selected={source}
            onSelect={setSource}
          />
          {source && (
            <Panel className="p-4 text-sm">
              <p className="text-xs tracking-[0.12em] text-muted uppercase">Selected</p>
              <p className="mt-1 font-medium">{source.title}</p>
              <div className="mt-2 flex items-center gap-2">
                {source.audio_features?.key_camelot && (
                  <Pill tone="key">{source.audio_features.key_camelot}</Pill>
                )}
                {source.audio_features?.bpm != null && (
                  <span className="data text-xs text-accent">
                    {source.audio_features.bpm.toFixed(1)} BPM
                  </span>
                )}
              </div>
            </Panel>
          )}
        </div>

        <div>
          {!source && (
            <EmptyState>Pick a track to see harmonic matches from your library.</EmptyState>
          )}

          {source && isPending && <p className="text-sm text-muted">Scoring your library…</p>}

          {source && isError && (
            <p role="alert" className="rounded-lg bg-rose-950/40 p-4 text-sm text-rose-300">
              {/* Most likely the 409 for a track that has not been analysed — the
                  backend's message already says so, so it is shown as-is. */}
              {(error as Error).message}
            </p>
          )}

          {matches?.length === 0 && (
            <EmptyState>
              Nothing to match against yet — the rest of your library still needs analysing.
            </EmptyState>
          )}

          {matches && matches.length > 0 && (
            <ol className="space-y-2">
              {matches.map(({ track, score, harmonic, tempo }) => (
                <li key={track.id}>
                  <Panel className="flex items-center gap-4 px-4 py-3 transition hover:border-accent/40">
                    <span className={`data w-10 text-2xl font-semibold ${scoreTone(score)}`}>
                      {score}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        to={`/tracks/${track.id}`}
                        className="block truncate font-medium hover:text-accent"
                      >
                        {track.title}
                      </Link>
                      <span className="block truncate text-xs text-muted">
                        {track.artist ?? "—"}
                      </span>
                    </span>
                    <Pill tone="key">{harmonic.track_b_key}</Pill>
                    <span className="data w-14 text-right text-xs text-accent">
                      {tempo.track_b_bpm.toFixed(0)}
                    </span>
                    <span className="w-28 text-right text-xs text-muted">
                      {harmonic.relation.replace(/_/g, " ")}
                    </span>
                    <span className="data w-20 text-right text-xs text-muted">
                      {tempo.delta_percent.toFixed(1)}%
                    </span>
                  </Panel>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
