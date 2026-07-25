import { useState, type FormEvent } from "react";
import { CompatibilityPanel } from "../components/CompatibilityPanel";
import { StarRating } from "../components/StarRating";
import { TrackPicker } from "../components/TrackPicker";
import { useCompatibility, useCreateCombo } from "../hooks/useCombos";
import { useTracks } from "../hooks/useTracks";
import type { TrackDetail } from "../types/xfade";

const TECHNIQUES = ["bass swap", "long blend", "cut", "echo out", "loop roll", "spinback"];

export function ComboLogger() {
  const { data: tracks } = useTracks();
  const [trackA, setTrackA] = useState<TrackDetail | null>(null);
  const [trackB, setTrackB] = useState<TrackDetail | null>(null);
  const [technique, setTechnique] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [logged, setLogged] = useState<string | null>(null);

  const compatibility = useCompatibility(trackA?.id ?? null, trackB?.id ?? null);
  const createCombo = useCreateCombo();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trackA || !trackB) return;

    createCombo.mutate(
      {
        track_a_id: trackA.id,
        track_b_id: trackB.id,
        technique: technique.trim() || null,
        rating,
        // One note per line; the backend stores them as separate rows.
        notes: notes
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => {
          setLogged(`${trackA.title} → ${trackB.title}`);
          // Keep deck A: the track you just mixed out of is usually the one you
          // mixed into next. Logging a run of transitions should not mean
          // re-picking the same track every time.
          setTrackA(trackB);
          setTrackB(null);
          setTechnique("");
          setRating(null);
          setNotes("");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Log a combo</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          What you mixed, how it went.
        </p>
      </div>

      {logged && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Logged {logged}.
        </p>
      )}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <TrackPicker
            label="From (track A)"
            tracks={tracks ?? []}
            selected={trackA}
            onSelect={setTrackA}
            excludeId={trackB?.id}
          />
          <TrackPicker
            label="Into (track B)"
            tracks={tracks ?? []}
            selected={trackB}
            onSelect={setTrackB}
            excludeId={trackA?.id}
          />
        </div>

        <div className="space-y-4">
          <CompatibilityPanel
            data={compatibility.data}
            isPending={compatibility.isPending}
            error={(compatibility.error as Error) ?? null}
            ready={Boolean(trackA && trackB)}
          />

          <label className="block">
            <span className="text-sm font-medium">Technique</span>
            <input
              type="text"
              list="techniques"
              value={technique}
              onChange={(event) => setTechnique(event.target.value)}
              placeholder="bass swap, long blend…"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
            <datalist id="techniques">
              {TECHNIQUES.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>

          <div>
            <span className="text-sm font-medium">Rating</span>
            <div className="mt-1">
              <StarRating value={rating} onChange={setRating} />
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium">
              Notes <span className="font-normal text-neutral-500">(one per line)</span>
            </span>
            <textarea
              value={notes}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          </label>

          {createCombo.isError && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              {(createCombo.error as Error).message}
            </p>
          )}

          <button
            type="submit"
            disabled={!trackA || !trackB || createCombo.isPending}
            className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {createCombo.isPending ? "Logging…" : "Log combo"}
          </button>
        </div>
      </form>
    </div>
  );
}
