import { useState, type FormEvent } from "react";
import { CompatibilityPanel } from "../components/CompatibilityPanel";
import { StarRating } from "../components/StarRating";
import { TrackPicker } from "../components/TrackPicker";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { useCompatibility, useCreateCombo } from "../hooks/useCombos";
import { useTracks } from "../hooks/useTracks";
import type { TrackDetail } from "../types/xfade";

const TECHNIQUES = ["bass swap", "long blend", "cut", "echo out", "loop roll", "spinback"];

const FIELD =
  "mt-1 block w-full rounded-md border border-edge bg-panel px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none";

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
          // Keep deck A: the track you just mixed into is usually the one you
          // mix out of next. Logging a run of transitions should not mean
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
      <PageHeader title="Log a combo" subtitle="What you mixed, and how it went." />

      {logged && (
        <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-300">
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
            <span className="text-xs tracking-[0.12em] text-muted uppercase">Technique</span>
            <input
              type="text"
              list="techniques"
              value={technique}
              onChange={(event) => setTechnique(event.target.value)}
              placeholder="bass swap, long blend…"
              className={FIELD}
            />
            <datalist id="techniques">
              {TECHNIQUES.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>

          <div>
            <span className="text-xs tracking-[0.12em] text-muted uppercase">Rating</span>
            <div className="mt-1">
              <StarRating value={rating} onChange={setRating} />
            </div>
          </div>

          <label className="block">
            <span className="text-xs tracking-[0.12em] text-muted uppercase">
              Notes <span className="normal-case">(one per line)</span>
            </span>
            <textarea
              value={notes}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
              className={FIELD}
            />
          </label>

          {createCombo.isError && (
            <p role="alert" className="text-sm text-rose-400">
              {(createCombo.error as Error).message}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={!trackA || !trackB || createCombo.isPending}
            className="w-full py-2"
          >
            {createCombo.isPending ? "Logging…" : "Log combo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
