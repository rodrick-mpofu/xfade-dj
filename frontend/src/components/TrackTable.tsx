import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sortTracks, type SortDirection, type SortKey } from "../lib/sortTracks";
import type { TrackDetail } from "../types/xfade";
import { ExtractionStatusBadge } from "./ExtractionStatus";
import { EmptyState } from "./ui/Panel";
import { Pill, formatDuration } from "./ui/Pill";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "title", label: "Track" },
  { key: "bpm", label: "BPM", numeric: true },
  { key: "key_camelot", label: "Key" },
  { key: "genre", label: "Genre" },
  { key: "duration", label: "Duration", numeric: true },
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
      setDirection(key === "title" || key === "artist" || key === "genre" ? "asc" : "desc");
    }
  };

  if (tracks.length === 0) {
    return <EmptyState>No tracks yet. Upload one to get started.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-edge">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-edge bg-panel">
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
                  className={`flex w-full items-center gap-1.5 px-4 py-3 text-xs font-medium tracking-[0.12em] text-muted uppercase transition hover:text-text ${
                    column.numeric ? "justify-end" : ""
                  }`}
                >
                  {column.label}
                  <span aria-hidden="true" className="text-[10px] text-accent">
                    {sortKey === column.key ? (direction === "asc" ? "▲" : "▼") : ""}
                  </span>
                </button>
              </th>
            ))}
            <th
              scope="col"
              className="px-4 py-3 text-xs font-medium tracking-[0.12em] text-muted uppercase"
            >
              Analysis
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {sorted.map((track) => {
            const features = track.audio_features;
            return (
              <tr key={track.id} className="transition hover:bg-panel">
                <td className="px-4 py-3">
                  <Link to={`/tracks/${track.id}`} className="font-medium hover:text-accent">
                    {track.title}
                  </Link>
                  <div className="data text-xs text-muted">{track.artist ?? "—"}</div>
                </td>
                <td className="data px-4 py-3 text-right text-accent">
                  {features?.bpm != null ? features.bpm.toFixed(0) : "—"}
                </td>
                <td className="px-4 py-3">
                  {features?.key_camelot ? <Pill tone="key">{features.key_camelot}</Pill> : "—"}
                </td>
                <td className="px-4 py-3">
                  {track.genre ? <Pill>{track.genre}</Pill> : <span className="text-muted">—</span>}
                </td>
                <td className="data px-4 py-3 text-right text-muted">
                  {formatDuration(features?.duration_seconds)}
                </td>
                <td className="px-4 py-3">
                  <ExtractionStatusBadge status={features?.status} error={features?.error_message} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
