import type { ReactNode } from "react";
import { Button } from "./ui/Button";

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
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-xl border border-edge bg-panel p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">{title}</h2>

        {consequence && <div className="mt-2 space-y-2 text-sm text-muted">{consequence}</div>}

        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-400">
            {error.message}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-raise hover:text-text"
          >
            Cancel
          </button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isPending}
            className="border-rose-700 bg-rose-600/90 !text-white hover:bg-rose-600"
          >
            {isPending ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
