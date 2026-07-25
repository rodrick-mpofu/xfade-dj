import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackDetail } from "./TrackDetail";
import type { ComboRead, TrackDetail as Track } from "../types/xfade";

const useTrack = vi.fn();
const useTrackCombos = vi.fn();
const useTracks = vi.fn();

vi.mock("../hooks/useTracks", () => ({
  useTrack: () => useTrack(),
  useTrackCombos: () => useTrackCombos(),
  useTracks: () => useTracks(),
}));

function track(id: string, title: string): Track {
  return {
    id,
    user_id: "u",
    title,
    artist: "Aphex Twin",
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
});
