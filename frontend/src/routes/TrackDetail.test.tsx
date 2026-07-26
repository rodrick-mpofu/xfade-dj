import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackDetail } from "./TrackDetail";
import type { ComboRead, TrackDetail as Track } from "../types/xfade";

const useTrack = vi.fn();
const useTrackCombos = vi.fn();
const useTracks = vi.fn();
const retryMutate = vi.fn();
const deleteTrackMutate = vi.fn();
const deleteComboMutate = vi.fn();
const navigate = vi.fn();

vi.mock("../hooks/useTracks", () => ({
  useTrack: () => useTrack(),
  useTrackCombos: () => useTrackCombos(),
  useTracks: () => useTracks(),
  useRetryExtraction: () => ({ mutate: retryMutate, isPending: false, isError: false }),
  useDeleteTrack: () => ({ mutate: deleteTrackMutate, isPending: false, error: null }),
  useDeleteCombo: () => ({ mutate: deleteComboMutate, isPending: false, error: null }),
}));

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => navigate,
}));

function track(id: string, title: string): Track {
  return {
    id,
    user_id: "u",
    title,
    artist: "Aphex Twin",
    genre: null,
    file_ref: null,
    source: "upload",
    created_at: "2026-07-25T12:00:00Z",
    audio_features: {
      track_id: id,
      status: "complete",
      bpm: 127.97,
      key_camelot: "8A",
      energy: 0.18,
      danceability: 1,
      duration_seconds: 210,
      structure_markers: null,
      error_message: null,
      analyzed_at: null,
    },
  };
}

const combo = (overrides: Partial<ComboRead> = {}): ComboRead => ({
  id: "c1",
  user_id: "u",
  track_a_id: "a",
  track_b_id: "b",
  technique: "bass swap",
  rating: 4,
  logged_at: "2026-07-25T12:00:00Z",
  notes: [{ id: "n1", combo_id: "c1", text: "held it 32 bars", created_at: "" }],
  ...overrides,
});

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/tracks/a"]}>
      <Routes>
        <Route path="/tracks/:trackId" element={<TrackDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe("TrackDetail", () => {
  beforeEach(() => {
    retryMutate.mockReset();
    deleteTrackMutate.mockReset();
    deleteComboMutate.mockReset();
    navigate.mockReset();
    useTrack.mockReturnValue({ data: track("a", "Windowlicker"), isPending: false, isError: false });
    useTrackCombos.mockReturnValue({ data: [] });
    useTracks.mockReturnValue({ data: [track("a", "Windowlicker"), track("b", "Come to Daddy")] });
  });

  it("shows the extracted features", () => {
    renderDetail();
    expect(screen.getByText("127.97")).toBeInTheDocument();
    expect(screen.getByText("8A")).toBeInTheDocument();
  });

  it("names the other track in a combo rather than calling it 'the other track'", () => {
    useTrackCombos.mockReturnValue({ data: [combo()] });
    renderDetail();

    const link = screen.getByRole("link", { name: "Come to Daddy" });
    expect(link).toHaveAttribute("href", "/tracks/b");
  });

  it("says which direction the transition went", () => {
    useTrackCombos.mockReturnValue({ data: [combo({ track_a_id: "b", track_b_id: "a" })] });
    renderDetail();
    expect(screen.getByText(/mixed from/i)).toBeInTheDocument();
  });

  it("falls back gracefully when the other track is not in the cached list", () => {
    useTracks.mockReturnValue({ data: [] });
    useTrackCombos.mockReturnValue({ data: [combo()] });
    renderDetail();

    expect(screen.getByRole("link", { name: "another track" })).toBeInTheDocument();
  });

  it("shows technique, rating and notes", () => {
    useTrackCombos.mockReturnValue({ data: [combo()] });
    renderDetail();

    expect(screen.getByText(/bass swap/)).toBeInTheDocument();
    expect(screen.getByText(/★★★★/)).toBeInTheDocument();
    expect(screen.getByText("held it 32 bars")).toBeInTheDocument();
  });

  it("reports a failed analysis with its reason", () => {
    const failed = track("a", "Windowlicker");
    failed.audio_features = {
      ...failed.audio_features!,
      status: "failed",
      error_message: "could not decode",
    };
    useTrack.mockReturnValue({ data: failed, isPending: false, isError: false });
    renderDetail();

    expect(screen.getByText(/could not decode/)).toBeInTheDocument();
  });

  it("says so when there are no combos yet", () => {
    renderDetail();
    expect(screen.getByText(/no combos logged/i)).toBeInTheDocument();
  });

  // --- retry ---------------------------------------------------------------

  it("re-queues extraction", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /re-analyse/i }));
    expect(retryMutate).toHaveBeenCalledWith("a");
  });

  it("will not re-queue while a job is already running", () => {
    const running = track("a", "Windowlicker");
    running.audio_features = { ...running.audio_features!, status: "processing" };
    useTrack.mockReturnValue({ data: running, isPending: false, isError: false });
    renderDetail();

    expect(screen.getByRole("button", { name: /re-analyse/i })).toBeDisabled();
  });

  it("offers re-analysis on a failed track", () => {
    const failed = track("a", "Windowlicker");
    failed.audio_features = {
      ...failed.audio_features!,
      status: "failed",
      error_message: "Too short to analyse",
    };
    useTrack.mockReturnValue({ data: failed, isPending: false, isError: false });
    renderDetail();

    expect(screen.getByRole("button", { name: /re-analyse/i })).toBeEnabled();
    expect(screen.getByText(/too short to analyse/i)).toBeInTheDocument();
  });

  // --- delete --------------------------------------------------------------

  it("asks before deleting", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(deleteTrackMutate).not.toHaveBeenCalled();
  });

  it("warns that logged combos go too, and how many", async () => {
    // The cascade is the whole reason this dialog exists: "delete" alone does not
    // say that the transitions you logged disappear with the track.
    const user = userEvent.setup();
    useTrackCombos.mockReturnValue({ data: [combo(), combo({ id: "c2" })] });
    renderDetail();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(screen.getByText(/2 logged combos/i)).toBeInTheDocument();
  });

  it("does not claim combos will be lost when there are none", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(screen.queryByText(/logged combo/i)).not.toBeInTheDocument();
  });

  it("cancelling leaves the track alone", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(deleteTrackMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes on confirmation and returns to the library", async () => {
    const user = userEvent.setup();
    deleteTrackMutate.mockImplementation((_id, options) => options.onSuccess());
    renderDetail();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    // Scoped to the dialog: the page's own Delete button is still on screen.
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^delete$/i }));

    expect(deleteTrackMutate).toHaveBeenCalled();
    expect(deleteTrackMutate.mock.calls[0]![0]).toBe("a");
    // Staying on a detail page for a track that no longer exists would 404.
    expect(navigate).toHaveBeenCalledWith("/library");
  });

  it("asks before deleting a combo", async () => {
    const user = userEvent.setup();
    useTrackCombos.mockReturnValue({ data: [combo()] });
    renderDetail();

    await user.click(screen.getByRole("button", { name: /delete combo/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(deleteComboMutate).not.toHaveBeenCalled();
  });
});
