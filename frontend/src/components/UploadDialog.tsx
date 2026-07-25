import { useState, type FormEvent } from "react";
import { useUploadTrack } from "../hooks/useTracks";

const ACCEPT = ".mp3,.m4a,.aac,.flac,.wav,.ogg,.aiff,.aif";

export function UploadDialog({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const upload = useUploadTrack();

  const handleFile = (next: File | null) => {
    setFile(next);
    // Filename minus extension is nearly always the title; pre-filling it is the
    // difference between two fields to type and none.
    if (next && !title) {
      setTitle(next.name.replace(/\.[^.]+$/, ""));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file || !title.trim()) return;
    upload.mutate(
      { file, title: title.trim(), artist: artist.trim() || undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900"
      >
        <h2 className="text-lg font-semibold">Add a track</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          BPM, key and energy are analysed in the background after upload.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Audio file</span>
            <input
              type="file"
              accept={ACCEPT}
              required
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-neutral-800"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Title</span>
            <input
              type="text"
              value={title}
              required
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">
              Artist <span className="font-normal text-neutral-500">(optional)</span>
            </span>
            <input
              type="text"
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          </label>
        </div>

        {upload.isError && (
          <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
            {(upload.error as Error).message}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={upload.isPending}
            className="rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={upload.isPending || !file || !title.trim()}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}
