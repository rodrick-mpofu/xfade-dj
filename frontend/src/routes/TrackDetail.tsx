import { Link, useParams } from "react-router-dom";
import { ExtractionStatusBadge } from "../components/ExtractionStatus";
import { useTrack, useTrackCombos } from "../hooks/useTracks";

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
  const { data: track, isPending, isError, error } = useTrack(trackId);
  const { data: combos } = useTrackCombos(trackId);

  if (isPending) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (isError) {
    return (
      <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
        {(error as Error).message}
      </p>
    );
  }

  const features = track.audio_features;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-sky-700 hover:underline dark:text-sky-400">
          ← Library
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{track.title}</h1>
        <p className="text-neutral-500 dark:text-neutral-400">{track.artist ?? "Unknown artist"}</p>
        <div className="mt-3">
          <ExtractionStatusBadge status={features?.status} error={features?.error_message} />
        </div>
      </div>

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
            {combos.map((combo) => (
              <li key={combo.id} className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {combo.track_a_id === track.id ? "Mixed into" : "Mixed from"}{" "}
                    <Link
                      to={`/tracks/${combo.track_a_id === track.id ? combo.track_b_id : combo.track_a_id}`}
                      className="text-sky-700 hover:underline dark:text-sky-400"
                    >
                      the other track
                    </Link>
                  </span>
                  <span className="text-neutral-500">
                    {combo.technique ?? "—"}
                    {combo.rating != null && ` · ${"★".repeat(combo.rating)}`}
                  </span>
                </div>
                {combo.notes.map((note) => (
                  <p key={note.id} className="mt-1 text-neutral-600 dark:text-neutral-400">
                    {note.text}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            No combos logged with this track yet.
          </p>
        )}
      </section>
    </div>
  );
}
