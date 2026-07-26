import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ExtractionStatusBadge } from "../components/ExtractionStatus";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { Pill, formatDuration } from "../components/ui/Pill";
import {
  useDeleteCombo,
  useDeleteTrack,
  useRetryExtraction,
  useTrack,
  useTrackCombos,
  useTracks,
} from "../hooks/useTracks";

type Confirming = { kind: "track" } | { kind: "combo"; id: string } | null;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-4">
      <dt className="text-xs tracking-[0.12em] text-muted uppercase">{label}</dt>
      <dd className="data mt-1 text-2xl font-semibold">{value}</dd>
    </Panel>
  );
}

export function TrackDetail() {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { data: track, isPending, isError, error } = useTrack(trackId);
  const { data: combos } = useTrackCombos(trackId);
  const { data: allTracks } = useTracks();

  const retry = useRetryExtraction();
  const deleteTrack = useDeleteTrack();
  const deleteCombo = useDeleteCombo();
  const [confirming, setConfirming] = useState<Confirming>(null);

  // The combo payload carries track ids, not titles. The library list is already
  // cached by the Library view, so naming the other side costs nothing.
  const titles = useMemo(
    () => new Map((allTracks ?? []).map((t) => [t.id, t.title])),
    [allTracks],
  );

  if (isPending) return <p className="text-sm text-muted">Loading…</p>;

  if (isError) {
    return (
      <p role="alert" className="rounded-lg bg-rose-950/40 p-4 text-sm text-rose-300">
        {(error as Error).message}
      </p>
    );
  }

  const features = track.audio_features;
  const comboCount = combos?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/library" className="text-sm text-accent hover:underline">
            ← Library
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{track.title}</h1>
          <p className="text-muted">{track.artist ?? "Unknown artist"}</p>
          <div className="mt-3 flex items-center gap-2">
            <ExtractionStatusBadge status={features?.status} error={features?.error_message} />
            {track.genre && <Pill>{track.genre}</Pill>}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            onClick={() => trackId && retry.mutate(trackId)}
            // Re-running while a job is in flight would race it; the backend
            // refuses too, but there is no reason to offer the click.
            disabled={features?.status === "processing" || retry.isPending}
          >
            {retry.isPending ? "Queueing…" : "Re-analyse"}
          </Button>
          <Button variant="danger" onClick={() => setConfirming({ kind: "track" })}>
            Delete
          </Button>
        </div>
      </div>

      {retry.isError && (
        <p role="alert" className="text-sm text-rose-400">
          {(retry.error as Error).message}
        </p>
      )}

      {features?.status === "failed" && features.error_message && (
        <p className="rounded-lg bg-rose-950/40 p-4 text-sm text-rose-300">
          Analysis failed: {features.error_message}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="BPM" value={features?.bpm != null ? features.bpm.toFixed(2) : "—"} />
        <Stat label="Key" value={features?.key_camelot ?? "—"} />
        <Stat label="Duration" value={formatDuration(features?.duration_seconds)} />
        <Stat label="Energy" value={features?.energy != null ? features.energy.toFixed(2) : "—"} />
        <Stat
          label="Danceability"
          value={features?.danceability != null ? features.danceability.toFixed(2) : "—"}
        />
      </dl>

      <section>
        <h2 className="text-lg font-semibold">Combos</h2>
        {combos && combos.length > 0 ? (
          <Panel className="mt-3 divide-y divide-edge">
            {combos.map((combo) => {
              const isSource = combo.track_a_id === track.id;
              const otherId = isSource ? combo.track_b_id : combo.track_a_id;
              return (
                <div key={combo.id} className="p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      <span className="text-muted">{isSource ? "Mixed into" : "Mixed from"}</span>{" "}
                      <Link to={`/tracks/${otherId}`} className="font-medium hover:text-accent">
                        {titles.get(otherId) ?? "another track"}
                      </Link>
                    </span>
                    <span className="flex items-center gap-3 text-muted">
                      {combo.technique ?? "—"}
                      {combo.rating != null && (
                        <span className="text-accent">{"★".repeat(combo.rating)}</span>
                      )}
                      <button
                        type="button"
                        aria-label="Delete combo"
                        onClick={() => setConfirming({ kind: "combo", id: combo.id })}
                        className="rounded px-2 py-0.5 transition hover:bg-raise hover:text-text"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                  {combo.notes.map((note) => (
                    <p key={note.id} className="data mt-1 text-xs text-muted">
                      {note.text}
                    </p>
                  ))}
                </div>
              );
            })}
          </Panel>
        ) : (
          <p className="mt-2 text-sm text-muted">No combos logged with this track yet.</p>
        )}
      </section>

      {confirming?.kind === "track" && (
        <ConfirmDialog
          title={`Delete “${track.title}”?`}
          consequence={
            <>
              <p>The audio file and its analysis will be removed.</p>
              {comboCount > 0 && (
                <p className="font-medium text-rose-400">
                  This also deletes {comboCount} logged combo
                  {comboCount === 1 ? "" : "s"} involving this track.
                </p>
              )}
              <p>This cannot be undone.</p>
            </>
          }
          isPending={deleteTrack.isPending}
          error={(deleteTrack.error as Error) ?? null}
          onCancel={() => setConfirming(null)}
          onConfirm={() =>
            trackId &&
            deleteTrack.mutate(trackId, {
              onSuccess: () => navigate("/library"),
            })
          }
        />
      )}

      {confirming?.kind === "combo" && (
        <ConfirmDialog
          title="Delete this combo?"
          consequence={<p>Its notes go with it. This cannot be undone.</p>}
          isPending={deleteCombo.isPending}
          error={(deleteCombo.error as Error) ?? null}
          onCancel={() => setConfirming(null)}
          onConfirm={() =>
            deleteCombo.mutate(confirming.id, { onSuccess: () => setConfirming(null) })
          }
        />
      )}
    </div>
  );
}
