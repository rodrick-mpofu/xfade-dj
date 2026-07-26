import { useMemo, useState } from "react";
import { bpmOf, keyOf } from "../lib/features";
import { filterTracks } from "../lib/filterTracks";
import type { TrackDetail } from "../types/xfade";
import { Pill } from "./ui/Pill";

function TrackSummary({ track }: { track: TrackDetail }) {
  const features = track.audio_features;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate font-medium">{track.title}</span>
      <span className="truncate text-xs text-muted">{track.artist ?? "—"}</span>
      {keyOf(features) && <Pill tone="key">{keyOf(features)}</Pill>}
      {bpmOf(features) != null && (
        <span className="data text-xs text-accent">{bpmOf(features)!.toFixed(0)}</span>
      )}
    </span>
  );
}

export function TrackPicker({
  label,
  tracks,
  selected,
  onSelect,
  excludeId,
}: {
  label: string;
  tracks: TrackDetail[];
  selected: TrackDetail | null;
  onSelect: (track: TrackDetail | null) => void;
  excludeId?: string | null;
}) {
  const [query, setQuery] = useState("");

  // The other deck's track is not a legal choice — the backend rejects a combo of a
  // track with itself, so it should never be offerable in the first place.
  const candidates = useMemo(
    () => filterTracks(tracks.filter((t) => t.id !== excludeId), query),
    [tracks, query, excludeId],
  );

  if (selected) {
    return (
      <div>
        <span className="text-xs tracking-[0.12em] text-muted uppercase">{label}</span>
        <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-accent/40 bg-panel px-3 py-2.5 text-sm">
          <TrackSummary track={selected} />
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="shrink-0 rounded px-2 py-0.5 text-xs text-muted transition hover:bg-raise hover:text-text"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block">
        <span className="text-xs tracking-[0.12em] text-muted uppercase">{label}</span>
        <input
          type="search"
          value={query}
          placeholder="Search by title, artist or key…"
          onChange={(event) => setQuery(event.target.value)}
          className="mt-1 block w-full rounded-md border border-edge bg-panel px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-edge">
        {candidates.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted">No matching tracks.</li>
        )}
        {candidates.map((track) => (
          <li key={track.id}>
            <button
              type="button"
              onClick={() => onSelect(track)}
              className="block w-full px-3 py-2 text-left text-sm transition hover:bg-raise"
            >
              <TrackSummary track={track} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
