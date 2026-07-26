import type { CompatibilityRead } from "../types/xfade";
import { Panel } from "./ui/Panel";

/** Bands are presentational only — the score itself comes from the backend rules. */
export function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  return "text-rose-400";
}

export function CompatibilityPanel({
  data,
  isPending,
  error,
  ready,
}: {
  data: CompatibilityRead | undefined;
  isPending: boolean;
  error: Error | null;
  /** Both decks chosen. Until then there is nothing to score. */
  ready: boolean;
}) {
  if (!ready) {
    return (
      <Panel className="p-5">
        <p className="text-sm text-muted">Pick both tracks to see how well they mix.</p>
      </Panel>
    );
  }

  if (isPending) {
    return (
      <Panel className="p-5">
        <p className="text-sm text-muted">Scoring…</p>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel className="p-5">
        <p role="alert" className="text-sm text-rose-400">
          {error.message}
        </p>
      </Panel>
    );
  }

  if (!data) return null;

  // Extraction is asynchronous, so "no score yet" is a normal state. Pending is
  // worth waiting on; failed never resolves, so it says so instead of spinning.
  if (data.status !== "ok" || data.score === null) {
    const message =
      data.status === "pending_extraction"
        ? "Still analysing one of these tracks. The score will appear when it finishes."
        : data.status === "extraction_failed"
          ? "Analysis failed for one of these tracks, so they cannot be scored. You can still log the combo."
          : "One of these tracks has no analysis data, so they cannot be scored. You can still log the combo.";

    return (
      <Panel className="p-5">
        <p className="text-sm text-muted">{message}</p>
      </Panel>
    );
  }

  return (
    <Panel className="p-5">
      <div className="flex items-baseline gap-3">
        <span className={`data text-5xl font-semibold ${scoreTone(data.score)}`}>
          {data.score}
        </span>
        <span className="text-sm text-muted">out of 100</span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs tracking-[0.12em] text-muted uppercase">Harmonic</dt>
          <dd className="mt-1">
            {data.harmonic && (
              <>
                <span className="data text-accent">{data.harmonic.track_a_key}</span>
                <span className="text-muted"> → </span>
                <span className="data text-accent">{data.harmonic.track_b_key}</span>
                <span className="ml-2 text-muted">
                  {data.harmonic.relation.replace(/_/g, " ")}
                </span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.12em] text-muted uppercase">Tempo</dt>
          <dd className="data mt-1">
            {data.tempo && (
              <>
                {data.tempo.track_a_bpm.toFixed(1)}
                <span className="text-muted"> → </span>
                {data.tempo.track_b_bpm.toFixed(1)}
                <span className="ml-2 text-muted">{data.tempo.delta_percent.toFixed(1)}% apart</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      {data.notes.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-muted">
          {data.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
