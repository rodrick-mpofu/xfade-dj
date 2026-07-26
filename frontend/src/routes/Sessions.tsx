import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SetlistIcon } from "../components/Icons";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, Panel } from "../components/ui/Panel";
import { useCreateSession, useDeleteSession, useSessions } from "../hooks/useSessions";
import type { SessionRead } from "../types/xfade";

const FIELD =
  "mt-1 block rounded-md border border-edge bg-panel px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none";

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
      <PageHeader title="Sessions" subtitle="Plan a setlist and check how each transition scores." />

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs tracking-[0.12em] text-muted uppercase">Name</span>
          <input
            type="text"
            value={name}
            required
            placeholder="Friday warm-up"
            onChange={(event) => setName(event.target.value)}
            className={`${FIELD} w-56`}
          />
        </label>
        <label className="block">
          <span className="text-xs tracking-[0.12em] text-muted uppercase">
            Planned for <span className="normal-case">(optional)</span>
          </span>
          <input
            type="datetime-local"
            value={plannedFor}
            onChange={(event) => setPlannedFor(event.target.value)}
            className={FIELD}
          />
        </label>
        <Button
          type="submit"
          variant="primary"
          disabled={!name.trim() || createSession.isPending}
          className="py-2"
        >
          {createSession.isPending ? "Creating…" : "+ New session"}
        </Button>
      </form>

      {createSession.isError && (
        <p role="alert" className="text-sm text-rose-400">
          {(createSession.error as Error).message}
        </p>
      )}

      {isPending && <p className="text-sm text-muted">Loading sessions…</p>}

      {isError && (
        <p role="alert" className="rounded-lg bg-rose-950/40 p-4 text-sm text-rose-300">
          {(error as Error).message}
        </p>
      )}

      {sessions &&
        (sessions.length === 0 ? (
          <EmptyState>No sessions yet.</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <Panel key={session.id} className="flex flex-col p-5 transition hover:border-accent/40">
                <div className="flex items-start justify-between">
                  <span className="rounded-md bg-accent/10 p-2 text-accent">
                    <SetlistIcon />
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${session.name}`}
                    onClick={() => setDeleting(session)}
                    className="rounded px-2 py-0.5 text-muted transition hover:bg-raise hover:text-text"
                  >
                    ✕
                  </button>
                </div>

                <Link
                  to={`/sessions/${session.id}`}
                  className="mt-4 text-lg font-semibold hover:text-accent"
                >
                  {session.name}
                </Link>

                <div className="data mt-6 flex items-center justify-between border-t border-edge pt-3 text-xs text-muted">
                  <span>
                    {session.tracks.length} track{session.tracks.length === 1 ? "" : "s"}
                  </span>
                  {session.planned_for && (
                    <span>{new Date(session.planned_for).toLocaleDateString()}</span>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        ))}

      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          consequence={
            <p>
              The setlist is discarded. Your tracks and any combos you logged are not affected.
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
