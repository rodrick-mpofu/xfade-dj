import { useMemo, useState } from "react";
import { filterTracks } from "../lib/filterTracks";
import type { TrackDetail } from "../types/xfade";

function TrackSummary({ track }: { track: TrackDetail }) {
  const features = track.audio_features;
  return (
    <>
      <span className="font-medium">{track.title}</span>
      <span className="ml-2 text-neutral-500">{track.artist ?? "—"}</span>
      {features?.key_camelot && (
        <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">
          {features.key_camelot}
        </span>
      )}
      {features?.bpm != null && (
        <span className="ml-1.5 text-xs tabular-nums text-neutral-500">
          {features.bpm.toFixed(0)} BPM
        </span>
      )}
    </>
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
        <span className="text-sm font-medium">{label}</span>
        <div className="mt-1 flex items-center justify-between rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
          <span>
            <TrackSummary track={selected} />
          </span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="ml-2 rounded px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
        <span className="text-sm font-medium">{label}</span>
        <input
          type="search"
          value={query}
          placeholder="Search by title, artist or key…"
          onChange={(event) => setQuery(event.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </label>

      <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-800">
        {candidates.length === 0 && (
          <li className="px-3 py-2 text-sm text-neutral-500">No matching tracks.</li>
        )}
        {candidates.map((track) => (
          <li key={track.id}>
            <button
              type="button"
              onClick={() => onSelect(track)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              <TrackSummary track={track} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
