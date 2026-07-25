import type { ExtractionStatus as Status } from "../types/xfade";

const STYLES: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  processing: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const LABELS: Record<Status, string> = {
  pending: "Queued",
  processing: "Analysing",
  complete: "Analysed",
  failed: "Failed",
};

/**
 * Extraction runs in the background, so every view that shows features has to be
 * able to say "not yet" (build spec §5). A missing feature row reads as queued —
 * from the user's side there is no difference.
 */
export function ExtractionStatusBadge({
  status,
  error,
}: {
  status: Status | null | undefined;
  error?: string | null;
}) {
  const resolved: Status = status ?? "pending";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[resolved]}`}
      title={resolved === "failed" && error ? error : undefined}
    >
      {(resolved === "pending" || resolved === "processing") && (
        <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
      )}
      {LABELS[resolved]}
    </span>
  );
}
