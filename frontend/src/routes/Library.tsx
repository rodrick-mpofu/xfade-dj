import { useState } from "react";
import { TrackTable } from "../components/TrackTable";
import { UploadDialog } from "../components/UploadDialog";
import { useTracks } from "../hooks/useTracks";

export function Library() {
  const [uploading, setUploading] = useState(false);
  const { data: tracks, isPending, isError, error } = useTracks();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {tracks ? `${tracks.length} track${tracks.length === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploading(true)}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
        >
          Add track
        </button>
      </div>

      {isPending && <p className="text-sm text-neutral-500">Loading your library…</p>}

      {isError && (
        <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          Could not load tracks: {(error as Error).message}
        </p>
      )}

      {tracks && <TrackTable tracks={tracks} />}

      {uploading && <UploadDialog onClose={() => setUploading(false)} />}
    </div>
  );
}
