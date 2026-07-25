import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompatibilityPanel } from "./CompatibilityPanel";
import type { CompatibilityRead } from "../types/xfade";

const scored: CompatibilityRead = {
  track_a_id: "a",
  track_b_id: "b",
  status: "ok",
  score: 91,
  harmonic: { score: 0.85, relation: "relative", track_a_key: "8A", track_b_key: "8B" },
  tempo: {
    score: 1,
    track_a_bpm: 127.97,
    track_b_bpm: 129.99,
    delta_bpm: 2.02,
    delta_percent: 1.58,
    double_time: false,
  },
  notes: ["Relative major/minor — same root, different mood."],
};

const base = { isPending: false, error: null, ready: true };

describe("CompatibilityPanel", () => {
  it("asks for both tracks before scoring anything", () => {
    render(<CompatibilityPanel {...base} ready={false} data={undefined} />);
    expect(screen.getByText(/pick both tracks/i)).toBeInTheDocument();
  });

  it("shows the score and the reasoning behind it", () => {
    render(<CompatibilityPanel {...base} data={scored} />);

    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("8A")).toBeInTheDocument();
    expect(screen.getByText("8B")).toBeInTheDocument();
    expect(screen.getByText(/relative/)).toBeInTheDocument();
    expect(screen.getByText(/1.6% apart/)).toBeInTheDocument();
    expect(screen.getByText(/relative major\/minor/i)).toBeInTheDocument();
  });

  it("says analysis is still running, without implying failure", () => {
    render(
      <CompatibilityPanel
        {...base}
        data={{ ...scored, status: "pending_extraction", score: null }}
      />,
    );

    expect(screen.getByText(/still analysing/i)).toBeInTheDocument();
    expect(screen.queryByText("91")).not.toBeInTheDocument();
  });

  it("distinguishes a failed analysis from a pending one", () => {
    // Pending resolves on its own; failed never will. Telling the user to wait
    // for something that will not arrive is the bug this guards against.
    render(
      <CompatibilityPanel
        {...base}
        data={{ ...scored, status: "extraction_failed", score: null }}
      />,
    );

    expect(screen.getByText(/analysis failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/still analysing/i)).not.toBeInTheDocument();
  });

  it("still invites logging when there is no score", () => {
    // An unscoreable pair is not an unloggable one.
    render(
      <CompatibilityPanel {...base} data={{ ...scored, status: "missing_features", score: null }} />,
    );
    expect(screen.getByText(/can still log the combo/i)).toBeInTheDocument();
  });

  it("surfaces a request error", () => {
    render(<CompatibilityPanel {...base} data={undefined} error={new Error("Track not found")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Track not found");
  });

  it("shows a loading state while scoring", () => {
    render(<CompatibilityPanel {...base} isPending data={undefined} />);
    expect(screen.getByText(/scoring/i)).toBeInTheDocument();
  });

  it("reports a double-time match in the notes", () => {
    render(
      <CompatibilityPanel
        {...base}
        data={{ ...scored, notes: ["Tempos match at double/half time."] }}
      />,
    );
    expect(screen.getByText(/double\/half time/i)).toBeInTheDocument();
  });
});
