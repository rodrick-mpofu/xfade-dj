import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComboLogger } from "./ComboLogger";
import type { TrackDetail } from "../types/xfade";

const mutate = vi.fn();
const useCompatibility = vi.fn();

vi.mock("../hooks/useCombos", () => ({
  useCompatibility: (a: string | null, b: string | null) => useCompatibility(a, b),
  useCreateCombo: () => ({ mutate, isPending: false, isError: false }),
}));

function track(id: string, title: string): TrackDetail {
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
      bpm: 128,
      key_camelot: "8A",
      energy: 0.4,
      danceability: 0.5,
      structure_markers: null,
      error_message: null,
      analyzed_at: null,
    },
  };
}

const tracks = [track("a", "Windowlicker"), track("b", "Come to Daddy")];

vi.mock("../hooks/useTracks", () => ({
  useTracks: () => ({ data: tracks }),
}));

const pick = async (user: ReturnType<typeof userEvent.setup>, label: RegExp, title: string) => {
  const group = screen.getByText(label).closest("div")!;
  await user.click(within(group).getByRole("button", { name: new RegExp(title) }));
};

describe("ComboLogger", () => {
  beforeEach(() => {
    mutate.mockReset();
    useCompatibility.mockReturnValue({ data: undefined, isPending: false, error: null });
  });

  it("cannot submit until both tracks are chosen", async () => {
    render(<ComboLogger />);
    expect(screen.getByRole("button", { name: /log combo/i })).toBeDisabled();
  });

  it("does not ask for a score until both decks are set", () => {
    render(<ComboLogger />);
    expect(useCompatibility).toHaveBeenCalledWith(null, null);
  });

  it("requests the score as soon as both tracks are picked", async () => {
    const user = userEvent.setup();
    render(<ComboLogger />);

    await pick(user, /from \(track a\)/i, "Windowlicker");
    await pick(user, /into \(track b\)/i, "Come to Daddy");

    expect(useCompatibility).toHaveBeenLastCalledWith("a", "b");
  });

  it("does not offer the same track on both decks", async () => {
    const user = userEvent.setup();
    render(<ComboLogger />);

    await pick(user, /from \(track a\)/i, "Windowlicker");

    const deckB = screen.getByText(/into \(track b\)/i).closest("div")!;
    expect(within(deckB).queryByRole("button", { name: /Windowlicker/ })).not.toBeInTheDocument();
  });

  it("logs the combo with its technique, rating and notes", async () => {
    const user = userEvent.setup();
    render(<ComboLogger />);

    await pick(user, /from \(track a\)/i, "Windowlicker");
    await pick(user, /into \(track b\)/i, "Come to Daddy");
    await user.type(screen.getByLabelText(/technique/i), "bass swap");
    await user.click(screen.getByRole("button", { name: "4 stars" }));
    await user.type(screen.getByLabelText(/notes/i), "held it 32 bars\ncrowd went up");
    await user.click(screen.getByRole("button", { name: /log combo/i }));

    expect(mutate).toHaveBeenCalledOnce();
    expect(mutate.mock.calls[0]![0]).toEqual({
      track_a_id: "a",
      track_b_id: "b",
      technique: "bass swap",
      rating: 4,
      notes: ["held it 32 bars", "crowd went up"],
    });
  });

  it("sends null rather than empty strings for skipped fields", async () => {
    const user = userEvent.setup();
    render(<ComboLogger />);

    await pick(user, /from \(track a\)/i, "Windowlicker");
    await pick(user, /into \(track b\)/i, "Come to Daddy");
    await user.click(screen.getByRole("button", { name: /log combo/i }));

    expect(mutate.mock.calls[0]![0]).toMatchObject({ technique: null, rating: null, notes: [] });
  });

  it("carries track B over to deck A after logging", async () => {
    // A set is a chain: what you mixed into is what you mix out of next.
    const user = userEvent.setup();
    mutate.mockImplementation((_combo, options) => options.onSuccess());
    render(<ComboLogger />);

    await pick(user, /from \(track a\)/i, "Windowlicker");
    await pick(user, /into \(track b\)/i, "Come to Daddy");
    await user.click(screen.getByRole("button", { name: /log combo/i }));

    const deckA = screen.getByText(/from \(track a\)/i).closest("div")!;
    expect(within(deckA).getByText("Come to Daddy")).toBeInTheDocument();
    expect(screen.getByText(/logged windowlicker → come to daddy/i)).toBeInTheDocument();
  });

  it("clears the notes and rating after logging", async () => {
    const user = userEvent.setup();
    mutate.mockImplementation((_combo, options) => options.onSuccess());
    render(<ComboLogger />);

    await pick(user, /from \(track a\)/i, "Windowlicker");
    await pick(user, /into \(track b\)/i, "Come to Daddy");
    await user.type(screen.getByLabelText(/notes/i), "something");
    await user.click(screen.getByRole("button", { name: /log combo/i }));

    expect(screen.getByLabelText(/notes/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "4 stars" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
