import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sessions } from "./Sessions";
import type { SessionRead } from "../types/xfade";

const useSessions = vi.fn();
const createMutate = vi.fn();

vi.mock("../hooks/useSessions", () => ({
  useSessions: () => useSessions(),
  useCreateSession: () => ({ mutate: createMutate, isPending: false, isError: false }),
}));

const session: SessionRead = {
  id: "s1",
  user_id: "u",
  name: "Friday warm-up",
  planned_for: null,
  created_at: "2026-07-25T12:00:00Z",
  tracks: [
    { id: "e1", session_id: "s1", track_id: "a", position: 0 },
    { id: "e2", session_id: "s1", track_id: "b", position: 1 },
  ],
};

const renderSessions = () =>
  render(
    <MemoryRouter>
      <Sessions />
    </MemoryRouter>,
  );

describe("Sessions", () => {
  beforeEach(() => {
    createMutate.mockReset();
    useSessions.mockReturnValue({ isPending: false, isError: false, data: [session] });
  });

  it("links each session to its planner", () => {
    renderSessions();
    expect(screen.getByRole("link", { name: "Friday warm-up" })).toHaveAttribute(
      "href",
      "/sessions/s1",
    );
  });

  it("shows how many tracks a session holds", () => {
    renderSessions();
    expect(screen.getByText(/2 tracks/)).toBeInTheDocument();
  });

  it("says so when there are no sessions", () => {
    useSessions.mockReturnValue({ isPending: false, isError: false, data: [] });
    renderSessions();
    expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
  });

  it("creates a session with just a name", async () => {
    const user = userEvent.setup();
    renderSessions();

    await user.type(screen.getByLabelText(/name/i), "Saturday peak");
    await user.click(screen.getByRole("button", { name: /new session/i }));

    expect(createMutate.mock.calls[0]![0]).toEqual({
      name: "Saturday peak",
      planned_for: null,
    });
  });

  it("sends the planned time as an absolute instant", async () => {
    // The column is timestamptz and datetime-local carries no zone, so a bare
    // wall-clock string would be read as UTC and shift the time.
    const user = userEvent.setup();
    renderSessions();

    await user.type(screen.getByLabelText(/name/i), "Saturday peak");
    await user.type(screen.getByLabelText(/planned for/i), "2026-08-01T21:00");
    await user.click(screen.getByRole("button", { name: /new session/i }));

    const sent = createMutate.mock.calls[0]![0].planned_for as string;
    expect(sent).toBe(new Date("2026-08-01T21:00").toISOString());
    expect(sent).toMatch(/Z$/);
  });

  it("will not create a session without a name", () => {
    renderSessions();
    expect(screen.getByRole("button", { name: /new session/i })).toBeDisabled();
  });

  it("surfaces a load error", () => {
    useSessions.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("Not signed in."),
    });
    renderSessions();

    expect(screen.getByRole("alert")).toHaveTextContent("Not signed in.");
  });
});
