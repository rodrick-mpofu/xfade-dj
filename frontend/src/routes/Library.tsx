import { useMemo, useState } from "react";
import { TrackTable } from "../components/TrackTable";
import { UploadDialog } from "../components/UploadDialog";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { useTracks } from "../hooks/useTracks";
import { filterTracks } from "../lib/filterTracks";

export function Library() {
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const { data: tracks, isPending, isError, error } = useTracks();

  // Reuses the combo logger's matcher, so searching the library and picking a deck
  // behave identically — including matching on Camelot key.
  const visible = useMemo(() => filterTracks(tracks ?? [], query), [tracks, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library"
        subtitle={
          tracks
            ? `${tracks.length} track${tracks.length === 1 ? "" : "s"}, analysed on upload`
            : "Loading…"
        }
        action={
          <Button variant="primary" onClick={() => setUploading(true)}>
            + Add track
          </Button>
        }
      />

      <input
        type="search"
        value={query}
        placeholder="Search by title, artist or key…"
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search tracks"
        className="w-full max-w-lg rounded-md border border-edge bg-panel px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
      />

      {isPending && <p className="text-sm text-muted">Loading your library…</p>}

      {isError && (
        <p role="alert" className="rounded-lg bg-rose-950/40 p-4 text-sm text-rose-300">
          Could not load tracks: {(error as Error).message}
        </p>
      )}

      {tracks && <TrackTable tracks={visible} />}

      {uploading && <UploadDialog onClose={() => setUploading(false)} />}
    </div>
  );
}
