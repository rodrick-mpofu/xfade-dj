import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useCreateSession, useDeleteSession, useSessions } from "../hooks/useSessions";
import type { SessionRead } from "../types/xfade";

export function Sessions() {
  const { data: sessions, isPending, isError, error } = useSessions();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const [deleting, setDeleting] = useState<SessionRead | null>(null);
  const [name, setName] = useState("");
  const [plannedFor, setPlannedFor] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createSession.mutate(
      {
        name: name.trim(),
        // datetime-local gives no timezone; the backend column is timestamptz, so
        // send it as the browser's local instant rather than a bare wall time.
        planned_for: plannedFor ? new Date(plannedFor).toISOString() : null,
      },
      {
        onSuccess: () => {
          setName("");
          setPlannedFor("");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Plan a setlist and check how each transition scores.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            type="text"
            value={name}
            required
            placeholder="Friday warm-up"
            onChange={(event) => setName(event.target.value)}
            className="mt-1 block w-56 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">
            Planned for <span className="font-normal text-neutral-500">(optional)</span>
          </span>
          <input
            type="datetime-local"
            value={plannedFor}
            onChange={(event) => setPlannedFor(event.target.value)}
            className="mt-1 block rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>
        <button
          type="submit"
          disabled={!name.trim() || createSession.isPending}
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {createSession.isPending ? "Creating…" : "New session"}
        </button>
      </form>

      {createSession.isError && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {(createSession.error as Error).message}
        </p>
      )}

      {isPending && <p className="text-sm text-neutral-500">Loading sessions…</p>}

      {isError && (
        <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {(error as Error).message}
        </p>
      )}

      {sessions &&
        (sessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500 dark:border-neutral-700">
            No sessions yet.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between p-4">
                <Link
                  to={`/sessions/${session.id}`}
                  className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                >
                  {session.name}
                </Link>
                <span className="flex items-center gap-3 text-sm text-neutral-500">
                  {session.tracks.length} track{session.tracks.length === 1 ? "" : "s"}
                  {session.planned_for &&
                    ` · ${new Date(session.planned_for).toLocaleDateString()}`}
                  <button
                    type="button"
                    aria-label={`Delete ${session.name}`}
                    onClick={() => setDeleting(session)}
                    className="rounded px-2 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ))}

      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          consequence={
            <p>
              The setlist is discarded. Your tracks and any combos you logged are not
              affected.
            </p>
          }
          isPending={deleteSession.isPending}
          error={(deleteSession.error as Error) ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            deleteSession.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
          }
        />
      )}
    </div>
  );
}
