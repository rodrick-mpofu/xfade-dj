/**
 * Energy as a bar plus its value.
 *
 * A bar rather than a bare number because the figure is calibrated against this
 * library — a track's energy only means anything next to the others, and a row of
 * bars is scannable in a way that a column of decimals is not.
 *
 * The bar is decorative and hidden from assistive tech; the number beside it carries
 * the same information as text, so there is nothing to announce twice.
 */
export function EnergyMeter({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <span className="text-muted">—</span>;
  }

  const clamped = Math.max(0, Math.min(1, value));

  return (
    <span
      className="inline-flex items-center gap-2"
      title="Derived from loudness, brightness and onset rate, scaled across this library."
    >
      <span aria-hidden="true" className="h-1 w-10 overflow-hidden rounded-full bg-raise">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${clamped * 100}%` }}
        />
      </span>
      <span className="data text-muted">{clamped.toFixed(2)}</span>
    </span>
  );
}
