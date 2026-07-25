import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sortTracks, type SortDirection, type SortKey } from "../lib/sortTracks";
import type { TrackDetail } from "../types/xfade";
import { ExtractionStatusBadge } from "./ExtractionStatus";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "title", label: "Title" },
  { key: "artist", label: "Artist" },
  { key: "bpm", label: "BPM", numeric: true },
  { key: "key_camelot", label: "Key" },
  { key: "energy", label: "Energy", numeric: true },
  { key: "created_at", label: "Added" },
];

export function TrackTable({ tracks }: { tracks: TrackDetail[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [direction, setDirection] = useState<SortDirection>("desc");

  const sorted = useMemo(
    () => sortTracks(tracks, sortKey, direction),
    [tracks, sortKey, direction],
  );

  const toggle = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection(key === "title" || key === "artist" ? "asc" : "desc");
    }
  };

  if (tracks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        No tracks yet. Upload one to get started.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="p-0">
                <button
                  type="button"
                  onClick={() => toggle(column.key)}
                  aria-sort={
                    sortKey === column.key
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={`flex w-full items-center gap-1 px-4 py-2.5 font-medium hover:text-neutral-900 dark:hover:text-neutral-100 ${
                    column.numeric ? "justify-end" : ""
                  }`}
                >
                  {column.label}
                  <span aria-hidden="true" className="text-xs">
                    {sortKey === column.key ? (direction === "asc" ? "▲" : "▼") : ""}
                  </span>
                </button>
              </th>
            ))}
            <th scope="col" className="px-4 py-2.5 font-medium">
              Analysis
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {sorted.map((track) => {
            const features = track.audio_features;
            return (
              <tr key={track.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                <td className="px-4 py-2.5">
                  <Link
                    to={`/tracks/${track.id}`}
                    className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                  >
                    {track.title}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                  {track.artist ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {features?.bpm != null ? features.bpm.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {features?.key_camelot ? (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">
                      {features.key_camelot}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {features?.energy != null ? features.energy.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                  {new Date(track.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5">
                  <ExtractionStatusBadge
                    status={features?.status}
                    error={features?.error_message}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
