import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionPlanner } from "./SessionPlanner";
import type { CompatibilityRead, SessionRead, TrackDetail } from "../types/xfade";

const useSession = vi.fn();
const useAdjacentCompatibility = vi.fn();
const replaceMutate = vi.fn();
const addMutate = vi.fn();

vi.mock("../hooks/useSessions", () => ({
  useSession: () => useSession(),
  useAdjacentCompatibility: (ids: string[]) => useAdjacentCompatibility(ids),
  useReplaceSessionTracks: () => ({ mutate: replaceMutate, isError: false }),
  useAddSessionTrack: () => ({ mutate: addMutate }),
}));

function track(id: string, title: string, key: string): TrackDetail {
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
      bpm: 128,
      key_camelot: key,
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
}

const library = [track("a", "First", "8A"), track("b", "Second", "8B"), track("c", "Third", "9A")];

vi.mock("../hooks/useTracks", () => ({
  useTracks: () => ({ data: library }),
}));

function session(trackIds: string[]): SessionRead {
  return {
    id: "s1",
    user_id: "u",
    name: "Friday warm-up",
    planned_for: null,
    created_at: "2026-07-25T12:00:00Z",
    // Deliberately out of order: the planner must sort by position, since
    // PostgREST makes no promise about embed ordering.
    tracks: trackIds
      .map((trackId, index) => ({
        id: `entry-${index}`,
        session_id: "s1",
        track_id: trackId,
        position: index,
      }))
      .reverse(),
  };
}

const scored = (score: number): { data: CompatibilityRead; isPending: boolean } => ({
  isPending: false,
  data: {
    track_a_id: "a",
    track_b_id: "b",
    status: "ok",
    score,
    harmonic: { score: 0.85, relation: "relative", track_a_key: "8A", track_b_key: "8B" },
    tempo: {
      score: 1,
      track_a_bpm: 128,
      track_b_bpm: 130,
      delta_bpm: 2,
      delta_percent: 1.6,
      double_time: false,
    },
    notes: [],
  },
});

const renderPlanner = () =>
  render(
    <MemoryRouter initialEntries={["/sessions/s1"]}>
      <Routes>
        <Route path="/sessions/:sessionId" element={<SessionPlanner />} />
      </Routes>
    </MemoryRouter>,
  );

describe("SessionPlanner", () => {
  beforeEach(() => {
    replaceMutate.mockReset();
    addMutate.mockReset();
    useSession.mockReturnValue({ data: session(["a", "b"]), isPending: false, isError: false });
    useAdjacentCompatibility.mockReturnValue([scored(91)]);
  });

  it("lists the setlist in play order", () => {
    const items = screen.queryAllByRole("listitem");
    expect(items).toEqual([]); // nothing rendered yet
    renderPlanner();

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("First");
    expect(rows[1]).toHaveTextContent("Second");
  });

  it("shows a score between each adjacent pair", () => {
    renderPlanner();
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(useAdjacentCompatibility).toHaveBeenCalledWith(["a", "b"]);
  });

  it("shows one fewer score than there are tracks", () => {
    useSession.mockReturnValue({ data: session(["a", "b", "c"]), isPending: false, isError: false });
    useAdjacentCompatibility.mockReturnValue([scored(91), scored(70)]);
    renderPlanner();

    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
  });

  it("moves a track down by replacing the whole order", () => {
    renderPlanner();
    return userEvent
      .setup()
      .click(screen.getByRole("button", { name: /move First down/i }))
      .then(() => {
        expect(replaceMutate).toHaveBeenCalledWith(["b", "a"]);
      });
  });

  it("moves a track up", async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(screen.getByRole("button", { name: /move Second up/i }));
    expect(replaceMutate).toHaveBeenCalledWith(["b", "a"]);
  });

  it("cannot move the first track up or the last one down", () => {
    renderPlanner();
    expect(screen.getByRole("button", { name: /move First up/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /move Second down/i })).toBeDisabled();
  });

  it("removes a track", async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(screen.getByRole("button", { name: /remove First/i }));
    expect(replaceMutate).toHaveBeenCalledWith(["b"]);
  });

  it("appends rather than replacing when adding a track", async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(screen.getByRole("button", { name: /add track/i }));
    await user.click(screen.getByRole("button", { name: /Third/ }));

    expect(addMutate).toHaveBeenCalledWith("c");
    expect(replaceMutate).not.toHaveBeenCalled();
  });

  it("marks a repeated track rather than scoring it against itself", () => {
    // The backend refuses to score a track with itself, so the planner must not ask.
    useSession.mockReturnValue({ data: session(["a", "a"]), isPending: false, isError: false });
    useAdjacentCompatibility.mockReturnValue([{ data: undefined, isPending: false }]);
    renderPlanner();

    expect(screen.getByText(/same track/i)).toBeInTheDocument();
  });

  it("prompts when the setlist is empty", () => {
    useSession.mockReturnValue({ data: session([]), isPending: false, isError: false });
    useAdjacentCompatibility.mockReturnValue([]);
    renderPlanner();

    expect(screen.getByText(/empty setlist/i)).toBeInTheDocument();
  });

  it("survives a track that is missing from the library", () => {
    useSession.mockReturnValue({ data: session(["missing"]), isPending: false, isError: false });
    useAdjacentCompatibility.mockReturnValue([]);
    renderPlanner();

    expect(screen.getByText(/unknown track/i)).toBeInTheDocument();
  });
});
