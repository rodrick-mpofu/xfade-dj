import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StarRating } from "../components/StarRating";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, Panel } from "../components/ui/Panel";
import { Pill } from "../components/ui/Pill";
import { useCombos, useUpdateCombo } from "../hooks/useCombos";
import { bpmOf, keyOf } from "../lib/features";
import { useDeleteCombo, useTracks } from "../hooks/useTracks";
import type { ComboRead, TrackDetail } from "../types/xfade";

function TrackCard({ track }: { track: TrackDetail | undefined }) {
  const features = track?.audio_features;
  return (
    <div className="flex-1 rounded-lg border border-edge bg-raise p-4">
      <p className="truncate font-semibold">{track?.title ?? "Unknown track"}</p>
      <p className="truncate text-sm text-muted">{track?.artist ?? "—"}</p>
      <div className="mt-3 flex items-center gap-2">
        {bpmOf(features) != null && <Pill tone="key">{bpmOf(features)!.toFixed(0)}</Pill>}
        {keyOf(features) && <Pill tone="key">{keyOf(features)}</Pill>}
      </div>
    </div>
  );
}

/**
 * Inline correction of a logged combo's rating and technique.
 *
 * The tracks stay put: changing either side is a different transition, not a fix,
 * so that case remains a delete and a re-log.
 */
function ComboEditor({
  combo,
  onDone,
}: {
  combo: ComboRead;
  onDone: () => void;
}) {
  const updateCombo = useUpdateCombo();
  const [rating, setRating] = useState<number | null>(combo.rating);
  const [technique, setTechnique] = useState(combo.technique ?? "");

  const save = () => {
    updateCombo.mutate(
      // Both fields every time. The API distinguishes "omitted" from "cleared", but
      // this form shows both, so it always has an opinion about both.
      { id: combo.id, changes: { rating, technique } },
      { onSuccess: onDone },
    );
  };

  return (
    <div className="mt-3 space-y-3 border-t border-edge pt-3">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="mb-1 text-xs tracking-[0.12em] text-muted uppercase">Rating</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <label className="min-w-56 flex-1">
          <span className="mb-1 block text-xs tracking-[0.12em] text-muted uppercase">
            Technique
          </span>
          <input
            type="text"
            value={technique}
            maxLength={120}
            placeholder="bass swap, long blend…"
            onChange={(event) => setTechnique(event.target.value)}
            className="block w-full rounded-md border border-edge bg-panel px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      {updateCombo.isError && (
        <p role="alert" className="text-sm text-rose-400">
          {(updateCombo.error as Error).message}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="primary" onClick={save} disabled={updateCombo.isPending}>
          {updateCombo.isPending ? "Saving…" : "Save"}
        </Button>
        <Button onClick={onDone} disabled={updateCombo.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function Combos() {
  const { data: combos, isPending, isError, error } = useCombos();
  const { data: tracks } = useTracks();
  const deleteCombo = useDeleteCombo();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

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

            <div className="flex shrink-0 flex-col gap-1 self-start">
              <button
                type="button"
                aria-label="Edit combo"
                onClick={() => setEditing(editing === combo.id ? null : combo.id)}
                className="rounded px-2 py-1 text-xs text-muted transition hover:bg-raise hover:text-text"
              >
                Edit
              </button>
              <button
                type="button"
                aria-label="Delete combo"
                onClick={() => setDeleting(combo.id)}
                className="rounded px-2 py-1 text-muted transition hover:bg-raise hover:text-text"
              >
                ✕
              </button>
            </div>
          </div>

          {editing === combo.id && (
            // Keyed by id so switching between combos resets the form to the new
            // one's values rather than carrying the previous card's edits across.
            <ComboEditor key={combo.id} combo={combo} onDone={() => setEditing(null)} />
          )}

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
