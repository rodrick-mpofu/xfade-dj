import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./Dashboard";
import type { ComboRead, SessionRead, TrackDetail } from "../types/xfade";

const useTracks = vi.fn();
const useCombos = vi.fn();
const useSessions = vi.fn();

vi.mock("../hooks/useTracks", () => ({ useTracks: () => useTracks() }));
vi.mock("../hooks/useCombos", () => ({ useCombos: () => useCombos() }));
vi.mock("../hooks/useSessions", () => ({ useSessions: () => useSessions() }));

function track(id: string, title: string, status = "complete"): TrackDetail {
  return {
    id,
    user_id: "u",
    title,
    artist: null,
    genre: null,
    file_ref: null,
    source: "upload",
    created_at: "2026-07-26T12:00:00Z",
    audio_features: {
      track_id: id,
      status: status as TrackDetail["audio_features"] extends null ? never : "complete",
      bpm: 128,
      key_camelot: "8A",
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

const combo = (id: string, rating: number | null, loggedAt: string): ComboRead => ({
  id,
  user_id: "u",
  track_a_id: "a",
  track_b_id: "b",
  technique: "bass swap",
  rating,
  logged_at: loggedAt,
  notes: [],
});

const session = (id: string, name: string, createdAt: string): SessionRead => ({
  id,
  user_id: "u",
  name,
  planned_for: null,
  created_at: createdAt,
  tracks: [],
});

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

describe("Dashboard", () => {
  beforeEach(() => {
    useTracks.mockReturnValue({ data: [track("a", "One"), track("b", "Two")] });
    useCombos.mockReturnValue({ data: [] });
    useSessions.mockReturnValue({ data: [] });
  });

  it("counts what is in the library", () => {
    useCombos.mockReturnValue({ data: [combo("c1", 5, "2026-07-01"), combo("c2", 3, "2026-07-02")] });
    useSessions.mockReturnValue({ data: [session("s1", "Friday", "2026-07-01")] });
    renderDashboard();

    const tileValue = (label: string) =>
      screen.getByText(label).closest("div")?.parentElement?.querySelector("p")?.textContent;

    expect(tileValue("Tracks")).toBe("2");
    expect(tileValue("Combos")).toBe("2");
    expect(tileValue("Sessions")).toBe("1");
    // Everything is analysed, so the ratio collapses to a single number.
    expect(tileValue("Analysed")).toBe("2");
  });

  it("shows how many tracks are analysed out of the total when some are pending", () => {
    useTracks.mockReturnValue({ data: [track("a", "One"), track("b", "Two", "pending")] });
    renderDashboard();

    // "1 / 2" rather than a bare "1": the ratio is the useful number while
    // extraction is still catching up.
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("ranks combos by rating, then by recency", () => {
    useCombos.mockReturnValue({
      data: [
        combo("low", 2, "2026-07-10"),
        combo("older-five", 5, "2026-07-01"),
        combo("newer-five", 5, "2026-07-09"),
      ],
    });
    renderDashboard();

    const rows = screen.getAllByRole("listitem");
    // Both 5s come first, and the newer of them leads.
    expect(within(rows[0]!).getByText("5★")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("5★")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("2★")).toBeInTheDocument();
  });

  it("names both sides of a combo", () => {
    useCombos.mockReturnValue({ data: [combo("c1", 4, "2026-07-01")] });
    renderDashboard();

    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("→ Two")).toBeInTheDocument();
  });

  it("labels an unrated combo rather than showing a zero", () => {
    useCombos.mockReturnValue({ data: [combo("c1", null, "2026-07-01")] });
    renderDashboard();

    expect(screen.getByText("unrated")).toBeInTheDocument();
    expect(screen.queryByText("0★")).not.toBeInTheDocument();
  });

  it("points somewhere useful when there is nothing logged", () => {
    renderDashboard();
    expect(screen.getByRole("link", { name: /log a combo/i })).toHaveAttribute("href", "/log");
    expect(screen.getByRole("link", { name: /plan one/i })).toHaveAttribute("href", "/sessions");
  });

  it("links recent sessions to their planner", () => {
    useSessions.mockReturnValue({ data: [session("s1", "Friday warm-up", "2026-07-20")] });
    renderDashboard();

    expect(screen.getByRole("link", { name: /friday warm-up/i })).toHaveAttribute(
      "href",
      "/sessions/s1",
    );
  });

  it("survives having no data at all", () => {
    useTracks.mockReturnValue({ data: undefined });
    useCombos.mockReturnValue({ data: undefined });
    useSessions.mockReturnValue({ data: undefined });

    expect(() => renderDashboard()).not.toThrow();
  });
});
