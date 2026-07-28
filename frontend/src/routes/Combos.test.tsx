import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Combos } from "./Combos";
import type { ComboRead, TrackDetail } from "../types/xfade";

const useCombos = vi.fn();
const useTracks = vi.fn();
const deleteMutate = vi.fn();
const updateMutate = vi.fn();
const updateState = { isPending: false, isError: false, error: null as Error | null };

vi.mock("../hooks/useCombos", () => ({
  useCombos: () => useCombos(),
  useUpdateCombo: () => ({ mutate: updateMutate, ...updateState }),
}));
vi.mock("../hooks/useTracks", () => ({
  useTracks: () => useTracks(),
  useDeleteCombo: () => ({ mutate: deleteMutate, isPending: false, error: null }),
}));

function track(id: string, title: string, key: string, bpm: number): TrackDetail {
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

const combo = (overrides: Partial<ComboRead> = {}): ComboRead => ({
  id: "c1",
  user_id: "u",
  track_a_id: "a",
  track_b_id: "b",
  technique: "bass swap",
  rating: 4,
  logged_at: "2026-07-26T12:00:00Z",
  notes: [{ id: "n1", combo_id: "c1", text: "held it 32 bars", created_at: "" }],
  ...overrides,
});

const renderCombos = () =>
  render(
    <MemoryRouter>
      <Combos />
    </MemoryRouter>,
  );

describe("Combos", () => {
  beforeEach(() => {
    deleteMutate.mockReset();
    updateMutate.mockReset();
    updateState.isPending = false;
    updateState.isError = false;
    updateState.error = null;
    useTracks.mockReturnValue({
      data: [track("a", "Windowlicker", "8A", 128), track("b", "Come to Daddy", "8B", 130)],
    });
    useCombos.mockReturnValue({ data: [combo()], isPending: false, isError: false });
  });

  it("shows both sides of the transition with their key and tempo", () => {
    renderCombos();

    expect(screen.getByText("Windowlicker")).toBeInTheDocument();
    expect(screen.getByText("Come to Daddy")).toBeInTheDocument();
    expect(screen.getByText("8A")).toBeInTheDocument();
    expect(screen.getByText("8B")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
  });

  it("shows the technique, rating and notes", () => {
    renderCombos();

    expect(screen.getByText("bass swap")).toBeInTheDocument();
    expect(screen.getByText("4★")).toBeInTheDocument();
    expect(screen.getByText(/held it 32 bars/)).toBeInTheDocument();
  });

  it("survives a combo whose track is missing from the library", () => {
    useTracks.mockReturnValue({ data: [] });
    renderCombos();

    expect(screen.getAllByText("Unknown track")).toHaveLength(2);
  });

  it("points to the logger when nothing is logged", () => {
    useCombos.mockReturnValue({ data: [], isPending: false, isError: false });
    renderCombos();

    expect(screen.getByRole("link", { name: /log your first transition/i })).toHaveAttribute(
      "href",
      "/log",
    );
  });

  it("asks before deleting", async () => {
    const user = userEvent.setup();
    renderCombos();

    await user.click(screen.getByRole("button", { name: /delete combo/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("deletes on confirmation", async () => {
    const user = userEvent.setup();
    renderCombos();

    await user.click(screen.getByRole("button", { name: /delete combo/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^delete$/i }));

    expect(deleteMutate.mock.calls[0]![0]).toBe("c1");
  });

  it("does not show the editor until Edit is clicked", () => {
    renderCombos();
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
  });

  it("opens the editor seeded with the combo's current values", async () => {
    const user = userEvent.setup();
    renderCombos();

    await user.click(screen.getByRole("button", { name: /edit combo/i }));

    expect(screen.getByDisplayValue("bass swap")).toBeInTheDocument();
    // 4 stars, so the fourth is pressed and the fifth is not.
    expect(screen.getByRole("button", { name: "4 stars" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "5 stars" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("saves the corrected rating and technique", async () => {
    const user = userEvent.setup();
    renderCombos();

    await user.click(screen.getByRole("button", { name: /edit combo/i }));
    await user.click(screen.getByRole("button", { name: "5 stars" }));
    await user.clear(screen.getByDisplayValue("bass swap"));
    await user.type(screen.getByRole("textbox"), "long blend");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateMutate.mock.calls[0]![0]).toEqual({
      id: "c1",
      changes: { rating: 5, technique: "long blend" },
    });
  });

  it("can clear a rating back to unrated", async () => {
    // Clicking the current rating clears it; without this a misclick is permanent.
    const user = userEvent.setup();
    renderCombos();

    await user.click(screen.getByRole("button", { name: /edit combo/i }));
    await user.click(screen.getByRole("button", { name: "4 stars" }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateMutate.mock.calls[0]![0]!.changes.rating).toBeNull();
  });

  it("closes without saving on cancel", async () => {
    const user = userEvent.setup();
    renderCombos();

    await user.click(screen.getByRole("button", { name: /edit combo/i }));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
  });

  it("surfaces a failed save and keeps the editor open", async () => {
    const user = userEvent.setup();
    updateState.isError = true;
    updateState.error = new Error("Combo not found.");
    renderCombos();

    await user.click(screen.getByRole("button", { name: /edit combo/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Combo not found.");
    // Still editable, so the correction is not lost along with the error.
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("bass swap")).toBeInTheDocument();
  });

  it("disables saving while the write is in flight", async () => {
    const user = userEvent.setup();
    updateState.isPending = true;
    renderCombos();

    await user.click(screen.getByRole("button", { name: /edit combo/i }));

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("surfaces a load error", () => {
    useCombos.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("Not signed in."),
    });
    renderCombos();

    expect(screen.getByRole("alert")).toHaveTextContent("Not signed in.");
  });
});
