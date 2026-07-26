import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ExtractionStatusBadge } from "../components/ExtractionStatus";
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
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
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

  if (isPending) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (isError) {
    return (
      <p
        role="alert"
        className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"
      >
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
          <Link to="/" className="text-sm text-sky-700 hover:underline dark:text-sky-400">
            ← Library
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{track.title}</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            {track.artist ?? "Unknown artist"}
          </p>
          <div className="mt-3">
            <ExtractionStatusBadge status={features?.status} error={features?.error_message} />
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => trackId && retry.mutate(trackId)}
            // Re-running while a job is in flight would race it; the backend
            // refuses too, but there is no reason to offer the click.
            disabled={features?.status === "processing" || retry.isPending}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {retry.isPending ? "Queueing…" : "Re-analyse"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming({ kind: "track" })}
            className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950"
          >
            Delete
          </button>
        </div>
      </div>

      {retry.isError && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {(retry.error as Error).message}
        </p>
      )}

      {features?.status === "failed" && features.error_message && (
        <p className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          Analysis failed: {features.error_message}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="BPM" value={features?.bpm != null ? features.bpm.toFixed(2) : "—"} />
        <Stat label="Key" value={features?.key_camelot ?? "—"} />
        <Stat label="Energy" value={features?.energy != null ? features.energy.toFixed(2) : "—"} />
        <Stat
          label="Danceability"
          value={features?.danceability != null ? features.danceability.toFixed(2) : "—"}
        />
      </dl>

      <section>
        <h2 className="text-lg font-semibold">Combos</h2>
        {combos && combos.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {combos.map((combo) => {
              const isSource = combo.track_a_id === track.id;
              const otherId = isSource ? combo.track_b_id : combo.track_a_id;
              return (
                <li key={combo.id} className="p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {isSource ? "Mixed into" : "Mixed from"}{" "}
                      <Link
                        to={`/tracks/${otherId}`}
                        className="text-sky-700 hover:underline dark:text-sky-400"
                      >
                        {titles.get(otherId) ?? "another track"}
                      </Link>
                    </span>
                    <span className="flex items-center gap-3 text-neutral-500">
                      {combo.technique ?? "—"}
                      {combo.rating != null && ` · ${"★".repeat(combo.rating)}`}
                      <button
                        type="button"
                        aria-label="Delete combo"
                        onClick={() => setConfirming({ kind: "combo", id: combo.id })}
                        className="rounded px-2 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                  {combo.notes.map((note) => (
                    <p key={note.id} className="mt-1 text-neutral-600 dark:text-neutral-400">
                      {note.text}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">No combos logged with this track yet.</p>
        )}
      </section>

      {confirming?.kind === "track" && (
        <ConfirmDialog
          title={`Delete “${track.title}”?`}
          consequence={
            <>
              <p>The audio file and its analysis will be removed.</p>
              {comboCount > 0 && (
                <p className="mt-2 font-medium text-rose-700 dark:text-rose-400">
                  This also deletes {comboCount} logged combo
                  {comboCount === 1 ? "" : "s"} involving this track.
                </p>
              )}
              <p className="mt-2">This cannot be undone.</p>
            </>
          }
          isPending={deleteTrack.isPending}
          error={(deleteTrack.error as Error) ?? null}
          onCancel={() => setConfirming(null)}
          onConfirm={() =>
            trackId &&
            deleteTrack.mutate(trackId, {
              onSuccess: () => navigate("/"),
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
