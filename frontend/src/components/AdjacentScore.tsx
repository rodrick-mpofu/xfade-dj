import type { CompatibilityRead } from "../types/xfade";

function toneFor(score: number): string {
  if (score >= 80) return "border-emerald-800 text-emerald-400";
  if (score >= 55) return "border-amber-800 text-amber-400";
  return "border-rose-900 text-rose-400";
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
    "relative flex items-center gap-2 py-1.5 pl-7 text-xs before:absolute before:left-3 before:h-full before:w-px before:bg-edge";

  if (isSameTrack) {
    return (
      <div className={frame}>
        <span className="text-muted">same track</span>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className={frame}>
        <span className="text-muted">scoring…</span>
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
        <span className="text-muted">{label}</span>
      </div>
    );
  }

  return (
    <div className={frame}>
      <span className={`data rounded-full border px-2 py-0.5 font-medium ${toneFor(data.score)}`}>
        {data.score}
      </span>
      {data.harmonic && (
        <span className="text-muted">
          <span className="data text-text">{data.harmonic.track_a_key}</span>
          {" → "}
          <span className="data text-text">{data.harmonic.track_b_key}</span>
          <span className="ml-1.5">{data.harmonic.relation.replace(/_/g, " ")}</span>
        </span>
      )}
      {data.tempo && (
        <span className="data text-muted">{data.tempo.delta_percent.toFixed(1)}% tempo</span>
      )}
    </div>
  );
}
