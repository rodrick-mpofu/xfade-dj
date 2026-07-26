import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Combos } from "./Combos";
import type { ComboRead, TrackDetail } from "../types/xfade";

const useCombos = vi.fn();
const useTracks = vi.fn();
const deleteMutate = vi.fn();

vi.mock("../hooks/useCombos", () => ({ useCombos: () => useCombos() }));
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
