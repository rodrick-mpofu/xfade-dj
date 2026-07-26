import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ComboIcon, LibraryIcon, SessionIcon, SetlistIcon } from "../components/Icons";
import { EmptyState, Panel, PanelHeading } from "../components/ui/Panel";
import { PageHeader } from "../components/ui/PageHeader";
import { useCombos } from "../hooks/useCombos";
import { useSessions } from "../hooks/useSessions";
import { useTracks } from "../hooks/useTracks";
import type { ComboRead } from "../types/xfade";

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs tracking-[0.12em] text-muted uppercase">{label}</span>
        <span className="text-muted">{icon}</span>
      </div>
      <p className="data mt-3 text-4xl font-semibold">{value}</p>
    </Panel>
  );
}

/**
 * The reference dashboard ranks combos by play count. Combos here are logged once
 * rather than incremented, so there is no such number — ranking by rating and then
 * by recency answers "what did I rate highest" instead of "what do I play most".
 * Different question, honestly labelled.
 */
function rankCombos(combos: ComboRead[]): ComboRead[] {
  return [...combos]
    .sort((a, b) => {
      const byRating = (b.rating ?? 0) - (a.rating ?? 0);
      if (byRating !== 0) return byRating;
      return new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime();
    })
    .slice(0, 5);
}

export function Dashboard() {
  const { data: tracks } = useTracks();
  const { data: combos } = useCombos();
  const { data: sessions } = useSessions();

  const titles = useMemo(
    () => new Map((tracks ?? []).map((track) => [track.id, track.title])),
    [tracks],
  );

  const analysed = (tracks ?? []).filter(
    (track) => track.audio_features?.status === "complete",
  ).length;
  const awaiting = (tracks ?? []).length - analysed;

  const topCombos = rankCombos(combos ?? []);
  const recentSessions = [...(sessions ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Your library at a glance." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Tracks" value={tracks?.length ?? "—"} icon={<LibraryIcon />} />
        <StatTile
          label="Analysed"
          value={tracks ? `${analysed}${awaiting ? ` / ${tracks.length}` : ""}` : "—"}
          icon={<SetlistIcon />}
        />
        <StatTile label="Combos" value={combos?.length ?? "—"} icon={<ComboIcon />} />
        <StatTile label="Sessions" value={sessions?.length ?? "—"} icon={<SessionIcon />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeading icon={<ComboIcon />}>Best rated combos</PanelHeading>
          <div className="p-5 pt-3">
            {topCombos.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing logged yet.{" "}
                <Link to="/log" className="text-accent hover:underline">
                  Log a combo
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {topCombos.map((combo) => (
                  <li
                    key={combo.id}
                    className="flex items-center justify-between gap-4 rounded-md bg-raise px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {titles.get(combo.track_a_id) ?? "Unknown track"}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        → {titles.get(combo.track_b_id) ?? "Unknown track"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {combo.rating != null ? (
                        <span className="data text-accent">{combo.rating}★</span>
                      ) : (
                        <span className="text-xs text-muted">unrated</span>
                      )}
                      {combo.technique && (
                        <span className="block text-xs text-muted">{combo.technique}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeading icon={<SessionIcon />}>Recent sessions</PanelHeading>
          <div className="p-5 pt-3">
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted">
                No sessions yet.{" "}
                <Link to="/sessions" className="text-accent hover:underline">
                  Plan one
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {recentSessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      to={`/sessions/${session.id}`}
                      className="flex items-center justify-between gap-4 rounded-md bg-raise px-3 py-2.5 text-sm transition hover:bg-edge"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{session.name}</span>
                        <span className="block text-xs text-muted">
                          {session.tracks.length} track{session.tracks.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      {session.planned_for && (
                        <span className="data shrink-0 text-xs text-muted">
                          {new Date(session.planned_for).toLocaleDateString()}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      {tracks?.length === 0 && (
        <EmptyState>
          Nothing here yet.{" "}
          <Link to="/library" className="text-accent hover:underline">
            Add a track
          </Link>{" "}
          to get started.
        </EmptyState>
      )}
    </div>
  );
}
