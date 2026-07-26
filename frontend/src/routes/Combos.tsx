import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, Panel } from "../components/ui/Panel";
import { Pill } from "../components/ui/Pill";
import { useCombos } from "../hooks/useCombos";
import { useDeleteCombo, useTracks } from "../hooks/useTracks";
import type { TrackDetail } from "../types/xfade";

function TrackCard({ track }: { track: TrackDetail | undefined }) {
  const features = track?.audio_features;
  return (
    <div className="flex-1 rounded-lg border border-edge bg-raise p-4">
      <p className="truncate font-semibold">{track?.title ?? "Unknown track"}</p>
      <p className="truncate text-sm text-muted">{track?.artist ?? "—"}</p>
      <div className="mt-3 flex items-center gap-2">
        {features?.bpm != null && <Pill tone="key">{features.bpm.toFixed(0)}</Pill>}
        {features?.key_camelot && <Pill tone="key">{features.key_camelot}</Pill>}
      </div>
    </div>
  );
}

export function Combos() {
  const { data: combos, isPending, isError, error } = useCombos();
  const { data: tracks } = useTracks();
  const deleteCombo = useDeleteCombo();
  const [deleting, setDeleting] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map((tracks ?? []).map((track) => [track.id, track])),
    [tracks],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Combos"
        subtitle="Every transition you have logged, newest first."
        action={
          <Link to="/log">
            <Button variant="primary">+ Log combo</Button>
          </Link>
        }
      />

      {isPending && <p className="text-sm text-muted">Loading combos…</p>}

      {isError && (
        <p role="alert" className="rounded-lg bg-rose-950/40 p-4 text-sm text-rose-300">
          {(error as Error).message}
        </p>
      )}

      {combos && combos.length === 0 && (
        <EmptyState>
          No combos logged yet.{" "}
          <Link to="/log" className="text-accent hover:underline">
            Log your first transition
          </Link>
          .
        </EmptyState>
      )}

      {combos?.map((combo) => (
        <Panel key={combo.id} className="p-5">
          <div className="flex items-stretch gap-4">
            <TrackCard track={byId.get(combo.track_a_id)} />

            {/* The arrow is the combo: direction matters, since A into B is not the
                same transition as B into A. */}
            <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1">
              <span className="flex size-10 items-center justify-center rounded-full border border-accent/40 text-accent">
                →
              </span>
              {combo.rating != null && (
                <span className="data text-sm text-accent">{combo.rating}★</span>
              )}
              {combo.technique && (
                <span className="text-center text-xs text-muted">{combo.technique}</span>
              )}
            </div>

            <TrackCard track={byId.get(combo.track_b_id)} />

            <button
              type="button"
              aria-label="Delete combo"
              onClick={() => setDeleting(combo.id)}
              className="self-start rounded px-2 py-1 text-muted transition hover:bg-raise hover:text-text"
            >
              ✕
            </button>
          </div>

          {combo.notes.length > 0 && (
            <div className="mt-3 border-t border-edge pt-3">
              {combo.notes.map((note) => (
                <p key={note.id} className="data text-xs text-muted">
                  “{note.text}”
                </p>
              ))}
            </div>
          )}
        </Panel>
      ))}

      {deleting && (
        <ConfirmDialog
          title="Delete this combo?"
          consequence={<p>Its notes go with it. This cannot be undone.</p>}
          isPending={deleteCombo.isPending}
          error={(deleteCombo.error as Error) ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteCombo.mutate(deleting, { onSuccess: () => setDeleting(null) })}
        />
      )}
    </div>
  );
}
