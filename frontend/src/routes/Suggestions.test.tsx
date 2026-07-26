import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Suggestions } from "./Suggestions";
import type { CompatibleTrack, TrackDetail } from "../types/xfade";

const useTracks = vi.fn();
const useCompatibleTracks = vi.fn();

vi.mock("../hooks/useTracks", () => ({ useTracks: () => useTracks() }));
vi.mock("../hooks/useCombos", () => ({
  useCompatibleTracks: (id: string | null) => useCompatibleTracks(id),
}));

function track(id: string, title: string, key = "8A", bpm = 128): TrackDetail {
  return {
    id,
    user_id: "u",
    title,
    artist: "Aphex Twin",
    genre: null,
    file_ref: null,
    source: "upload",
    created_at: "2026-07-26T12:00:00Z",
    audio_features: {
      track_id: id,
      status: "complete",
      bpm,
      key_camelot: key,
      energy: 0.3,
      danceability: 0.4,
      duration_seconds: 200,
      bpm_tag: null,
      key_camelot_tag: null,
      bpm_effective: null,
      key_camelot_effective: null,
      structure_markers: null,
      error_message: null,
      analyzed_at: null,
    },
  };
}

const match = (t: TrackDetail, score: number, relation = "adjacent"): CompatibleTrack => ({
  track: t,
  score,
  harmonic: {
    score: 0.9,
    relation,
    track_a_key: "8A",
    track_b_key: t.audio_features!.key_camelot!,
  },
  tempo: {
    score: 1,
    track_a_bpm: 128,
    track_b_bpm: t.audio_features!.bpm!,
    delta_bpm: 1,
    delta_percent: 0.8,
    double_time: false,
  },
  notes: [],
});

const library = [track("a", "Source"), track("b", "Neighbour", "9A"), track("c", "Relative", "8B")];

const renderSuggestions = () =>
  render(
    <MemoryRouter>
      <Suggestions />
    </MemoryRouter>,
  );

const pickSource = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(screen.getByRole("button", { name: new RegExp(title) }));
};

describe("Suggestions", () => {
  beforeEach(() => {
    useTracks.mockReturnValue({ data: library });
    useCompatibleTracks.mockReturnValue({ data: undefined, isPending: false, isError: false });
  });

  it("asks for a track before scoring anything", () => {
    renderSuggestions();

    expect(screen.getByText(/pick a track to see harmonic matches/i)).toBeInTheDocument();
    expect(useCompatibleTracks).toHaveBeenCalledWith(null);
  });

  it("requests suggestions once a track is chosen", async () => {
    const user = userEvent.setup();
    renderSuggestions();

    await pickSource(user, "Source");

    expect(useCompatibleTracks).toHaveBeenLastCalledWith("a");
  });

  it("lists matches with their score and reasoning", async () => {
    const user = userEvent.setup();
    useCompatibleTracks.mockReturnValue({
      data: [match(library[1]!, 94), match(library[2]!, 71, "relative")],
      isPending: false,
      isError: false,
    });
    renderSuggestions();

    await pickSource(user, "Source");

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("94")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("9A")).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/relative/)).toBeInTheDocument();
  });

  it("links each match to its track page", async () => {
    const user = userEvent.setup();
    useCompatibleTracks.mockReturnValue({
      data: [match(library[1]!, 94)],
      isPending: false,
      isError: false,
    });
    renderSuggestions();

    await pickSource(user, "Source");

    expect(screen.getByRole("link", { name: "Neighbour" })).toHaveAttribute("href", "/tracks/b");
  });

  it("surfaces the backend's reason when a track cannot be matched", async () => {
    // A source with no analysis returns 409 rather than an empty list, and the
    // message explains why — repeating it beats inventing a vaguer one.
    const user = userEvent.setup();
    useCompatibleTracks.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("This track has no analysis yet, so it cannot be matched against anything."),
    });
    renderSuggestions();

    await pickSource(user, "Source");

    expect(screen.getByRole("alert")).toHaveTextContent(/no analysis yet/i);
  });

  it("explains an empty result rather than showing a blank panel", async () => {
    const user = userEvent.setup();
    useCompatibleTracks.mockReturnValue({ data: [], isPending: false, isError: false });
    renderSuggestions();

    await pickSource(user, "Source");

    expect(screen.getByText(/still needs analysing/i)).toBeInTheDocument();
  });

  it("shows a loading state while scoring", async () => {
    const user = userEvent.setup();
    useCompatibleTracks.mockReturnValue({ data: undefined, isPending: true, isError: false });
    renderSuggestions();

    await pickSource(user, "Source");

    expect(screen.getByText(/scoring your library/i)).toBeInTheDocument();
  });
});
