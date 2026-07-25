import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TrackTable } from "./TrackTable";
import type { TrackDetail } from "../types/xfade";

function track(
  title: string,
  features?: Partial<NonNullable<TrackDetail["audio_features"]>>,
): TrackDetail {
  return {
    id: `id-${title}`,
    user_id: "u",
    title,
    artist: "Aphex Twin",
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

const bodyRowTitles = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);

describe("TrackTable", () => {
  it("prompts to upload when the library is empty", () => {
    renderTable([]);
    expect(screen.getByText(/no tracks yet/i)).toBeInTheDocument();
  });

  it("shows the feature columns the Library view is for", () => {
    renderTable([track("Windowlicker", { bpm: 128.04, key_camelot: "8A", energy: 0.42 })]);

    expect(screen.getByText("128.0")).toBeInTheDocument();
    expect(screen.getByText("8A")).toBeInTheDocument();
    expect(screen.getByText("0.42")).toBeInTheDocument();
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
    expect(bodyRowTitles()).toEqual(["fast", "slow"]);
  });

  it("reverses direction when the same header is clicked twice", async () => {
    const user = userEvent.setup();
    renderTable([track("slow", { bpm: 90 }), track("fast", { bpm: 174 })]);

    const header = screen.getByRole("button", { name: /bpm/i });
    await user.click(header);
    await user.click(header);

    expect(bodyRowTitles()).toEqual(["slow", "fast"]);
  });

  it("exposes sort state to assistive tech", async () => {
    const user = userEvent.setup();
    renderTable([track("a", { bpm: 90 })]);

    await user.click(screen.getByRole("button", { name: /^title/i }));
    expect(screen.getByRole("button", { name: /^title/i })).toHaveAttribute(
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
