import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TrackTable } from "./TrackTable";
import type { TrackDetail } from "../types/xfade";

function track(
  title: string,
  features?: Partial<NonNullable<TrackDetail["audio_features"]>>,
  genre: string | null = null,
): TrackDetail {
  return {
    id: `id-${title}`,
    user_id: "u",
    title,
    artist: "Aphex Twin",
    genre,
    file_ref: null,
    source: "upload",
    created_at: "2026-07-25T12:00:00Z",
    audio_features: features
      ? {
          track_id: `id-${title}`,
          status: "complete",
          bpm: null,
          key_camelot: null,
          energy: null,
          danceability: null,
          duration_seconds: null,
          structure_markers: null,
          error_message: null,
          analyzed_at: null,
          ...features,
        }
      : null,
  };
}

const renderTable = (tracks: TrackDetail[]) =>
  render(
    <MemoryRouter>
      <TrackTable tracks={tracks} />
    </MemoryRouter>,
  );

/** Row order by the track link, which is stable regardless of what else a cell holds. */
const rowOrder = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getByRole("link").textContent);

describe("TrackTable", () => {
  it("prompts to upload when the library is empty", () => {
    renderTable([]);
    expect(screen.getByText(/no tracks yet/i)).toBeInTheDocument();
  });

  it("shows the columns the Library view is for", () => {
    renderTable([
      track("Windowlicker", { bpm: 128.04, key_camelot: "8A", duration_seconds: 245 }, "Techno"),
    ]);

    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("8A")).toBeInTheDocument();
    expect(screen.getByText("Techno")).toBeInTheDocument();
    expect(screen.getByText("4:05")).toBeInTheDocument();
  });

  it("renders a dash rather than a blank for unanalysed tracks", () => {
    renderTable([track("Fresh")]);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows analysis state per row", () => {
    renderTable([
      track("Done", { status: "complete", bpm: 128 }),
      track("Waiting", { status: "pending" }),
      track("Broken", { status: "failed", error_message: "could not decode" }),
    ]);

    expect(screen.getByText("Analysed")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("sorts when a column header is clicked", async () => {
    const user = userEvent.setup();
    renderTable([track("slow", { bpm: 90 }), track("fast", { bpm: 174 })]);

    await user.click(screen.getByRole("button", { name: /bpm/i }));
    expect(rowOrder()).toEqual(["fast", "slow"]);
  });

  it("reverses direction when the same header is clicked twice", async () => {
    const user = userEvent.setup();
    renderTable([track("slow", { bpm: 90 }), track("fast", { bpm: 174 })]);

    const header = screen.getByRole("button", { name: /bpm/i });
    await user.click(header);
    await user.click(header);

    expect(rowOrder()).toEqual(["slow", "fast"]);
  });

  it("sorts by duration", async () => {
    const user = userEvent.setup();
    renderTable([
      track("long", { duration_seconds: 400 }),
      track("short", { duration_seconds: 120 }),
    ]);

    await user.click(screen.getByRole("button", { name: /duration/i }));
    expect(rowOrder()).toEqual(["long", "short"]);
  });

  it("exposes sort state to assistive tech", async () => {
    const user = userEvent.setup();
    renderTable([track("a", { bpm: 90 })]);

    await user.click(screen.getByRole("button", { name: /^track/i }));
    expect(screen.getByRole("button", { name: /^track/i })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("links each track to its detail view", () => {
    renderTable([track("Windowlicker", { bpm: 128 })]);
    expect(screen.getByRole("link", { name: "Windowlicker" })).toHaveAttribute(
      "href",
      "/tracks/id-Windowlicker",
    );
  });
});
