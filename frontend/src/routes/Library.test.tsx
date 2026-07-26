import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Library } from "./Library";
import type { TrackDetail } from "../types/xfade";

const useTracks = vi.fn();
vi.mock("../hooks/useTracks", () => ({
  useTracks: () => useTracks(),
  useUploadTrack: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

const sample: TrackDetail = {
  id: "abc",
  user_id: "u",
  title: "Windowlicker",
  artist: "Aphex Twin",
  genre: null,
  file_ref: null,
  source: "upload",
  created_at: "2026-07-25T12:00:00Z",
  audio_features: {
    track_id: "abc",
    status: "complete",
    bpm: 128,
    key_camelot: "8A",
    energy: 0.4,
    danceability: 0.5,
      duration_seconds: 210,
      bpm_tag: null,
      key_camelot_tag: null,
      bpm_effective: null,
      key_camelot_effective: null,
    structure_markers: null,
    error_message: null,
    analyzed_at: null,
  },
};

const renderLibrary = () =>
  render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>,
  );

describe("Library", () => {
  beforeEach(() => useTracks.mockReset());

  it("shows a loading state", () => {
    useTracks.mockReturnValue({ isPending: true, isError: false });
    renderLibrary();
    expect(screen.getByText(/loading your library/i)).toBeInTheDocument();
  });

  it("surfaces the backend's error message rather than a generic one", () => {
    useTracks.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("Not signed in."),
    });
    renderLibrary();

    expect(screen.getByRole("alert")).toHaveTextContent("Not signed in.");
  });

  it("lists tracks and counts them", () => {
    useTracks.mockReturnValue({ isPending: false, isError: false, data: [sample] });
    renderLibrary();

    expect(screen.getByText(/1 track,/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Windowlicker" })).toBeInTheDocument();
  });

  it("pluralises the count", () => {
    useTracks.mockReturnValue({
      isPending: false,
      isError: false,
      data: [sample, { ...sample, id: "def", title: "Second" }],
    });
    renderLibrary();

    expect(screen.getByText(/2 tracks,/)).toBeInTheDocument();
  });

  it("offers a way to add a track", () => {
    useTracks.mockReturnValue({ isPending: false, isError: false, data: [] });
    renderLibrary();

    expect(screen.getByRole("button", { name: /add track/i })).toBeInTheDocument();
  });
});
