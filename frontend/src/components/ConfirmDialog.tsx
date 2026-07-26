import type { ReactNode } from "react";

/**
 * Confirmation for destructive actions.
 *
 * `consequence` exists because the honest warning is the whole point here: deleting
 * a track also deletes every combo it appears in, and "delete" alone does not say
 * that. The caller passes what will actually be lost.
 */
export function ConfirmDialog({
  title,
  consequence,
  confirmLabel = "Delete",
  isPending = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  consequence?: ReactNode;
  confirmLabel?: string;
  isPending?: boolean;
  error?: Error | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">{title}</h2>

        {consequence && (
          <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{consequence}</div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
            {error.message}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
