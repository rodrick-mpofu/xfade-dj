import type { CompatibilityRead } from "../types/xfade";

function toneFor(score: number): string {
  if (score >= 80) return "border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400";
  if (score >= 55) return "border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-400";
  return "border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-400";
}

/**
 * The score for one transition, shown between the two tracks it applies to.
 *
 * Deliberately quiet: in a setlist this repeats once per gap, so it reads as an
 * annotation on the run order rather than competing with the tracks themselves.
 */
export function AdjacentScore({
  data,
  isPending,
  isSameTrack,
}: {
  data: CompatibilityRead | undefined;
  isPending: boolean;
  isSameTrack: boolean;
}) {
  const frame =
    "relative flex items-center gap-2 py-1 pl-6 text-xs before:absolute before:left-2 before:h-full before:w-px before:bg-neutral-200 dark:before:bg-neutral-800";

  if (isSameTrack) {
    return (
      <div className={frame}>
        <span className="text-neutral-400">same track</span>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className={frame}>
        <span className="text-neutral-400">scoring…</span>
      </div>
    );
  }

  if (!data || data.status !== "ok" || data.score === null) {
    const label =
      data?.status === "pending_extraction"
        ? "analysing…"
        : data?.status === "extraction_failed"
          ? "analysis failed"
          : "not scored";
    return (
      <div className={frame}>
        <span className="text-neutral-400">{label}</span>
      </div>
    );
  }

  return (
    <div className={frame}>
      <span
        className={`rounded-full border px-2 py-0.5 font-medium tabular-nums ${toneFor(data.score)}`}
      >
        {data.score}
      </span>
      {data.harmonic && (
        <span className="text-neutral-500">
          <span className="font-mono">{data.harmonic.track_a_key}</span>
          {" → "}
          <span className="font-mono">{data.harmonic.track_b_key}</span>
          <span className="ml-1.5">{data.harmonic.relation.replace(/_/g, " ")}</span>
        </span>
      )}
      {data.tempo && (
        <span className="text-neutral-500 tabular-nums">
          {data.tempo.delta_percent.toFixed(1)}% tempo
        </span>
      )}
    </div>
  );
}
