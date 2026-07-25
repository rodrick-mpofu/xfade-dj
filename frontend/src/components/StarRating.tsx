const STARS = [1, 2, 3, 4, 5];

export function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          // Clicking the current rating clears it — otherwise a misclick is
          // permanent and the field has no way back to "unrated".
          onClick={() => onChange(value === star ? null : star)}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          aria-pressed={value === star}
          className={`text-2xl leading-none transition-colors ${
            value !== null && star <= value
              ? "text-amber-500"
              : "text-neutral-300 hover:text-amber-300 dark:text-neutral-700"
          }`}
        >
          ★
        </button>
      ))}
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-2 text-xs text-neutral-500 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
