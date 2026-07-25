import type { CompatibilityRead } from "../types/xfade";

/** Bands are presentational only — the score itself comes from the backend rules. */
function scoreStyle(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 55) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">{children}</div>
  );
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
      <Frame>
        <p className="text-sm text-neutral-500">
          Pick both tracks to see how well they mix.
        </p>
      </Frame>
    );
  }

  if (isPending) {
    return (
      <Frame>
        <p className="text-sm text-neutral-500">Scoring…</p>
      </Frame>
    );
  }

  if (error) {
    return (
      <Frame>
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error.message}
        </p>
      </Frame>
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
      <Frame>
        <p className="text-sm text-neutral-500">{message}</p>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="flex items-baseline gap-3">
        <span className={`text-4xl font-semibold tabular-nums ${scoreStyle(data.score)}`}>
          {data.score}
        </span>
        <span className="text-sm text-neutral-500">out of 100</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Harmonic</dt>
          <dd className="mt-0.5">
            {data.harmonic && (
              <>
                <span className="font-mono">{data.harmonic.track_a_key}</span>
                {" → "}
                <span className="font-mono">{data.harmonic.track_b_key}</span>
                <span className="ml-2 text-neutral-500">
                  {data.harmonic.relation.replace(/_/g, " ")}
                </span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Tempo</dt>
          <dd className="mt-0.5 tabular-nums">
            {data.tempo && (
              <>
                {data.tempo.track_a_bpm.toFixed(1)} → {data.tempo.track_b_bpm.toFixed(1)}
                <span className="ml-2 text-neutral-500">
                  {data.tempo.delta_percent.toFixed(1)}% apart
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>

      {data.notes.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          {data.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
