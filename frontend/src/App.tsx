import { Link, NavLink, Route, Routes } from "react-router-dom";
import {
  ComboIcon,
  DashboardIcon,
  LibraryIcon,
  SessionIcon,
  SetlistIcon,
  SuggestionsIcon,
  XfadeMark,
} from "./components/Icons";
import { useAuth } from "./lib/auth";
import { ComboLogger } from "./routes/ComboLogger";
import { Library } from "./routes/Library";
import { Login } from "./routes/Login";
import { SessionPlanner } from "./routes/SessionPlanner";
import { Sessions } from "./routes/Sessions";
import { TrackDetail } from "./routes/TrackDetail";

/** Placeholder until stage C. */
function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Not built yet.</p>
    </div>
  );
}

function NotFound() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 text-sm text-muted">
        That page does not exist.{" "}
        <Link to="/" className="text-accent hover:underline">
          Back to the library
        </Link>
        .
      </p>
    </div>
  );
}

const NAV = [
  { to: "/", label: "Dashboard", icon: DashboardIcon, end: true },
  { to: "/library", label: "Library", icon: LibraryIcon },
  { to: "/sessions", label: "Sessions", icon: SetlistIcon },
  { to: "/combos", label: "Combos", icon: ComboIcon },
  { to: "/log", label: "Log a combo", icon: SessionIcon },
  { to: "/suggestions", label: "Suggestions", icon: SuggestionsIcon },
];

function Sidebar() {
  const { signOut, session } = useAuth();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-edge bg-panel/40">
      <div className="flex h-16 items-center gap-2 border-b border-edge px-5 text-accent">
        <XfadeMark />
        <span className="text-lg font-bold tracking-[0.2em]">XFADE</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted hover:bg-raise hover:text-text"
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-edge p-3">
        <p className="truncate px-3 text-xs text-muted">{session?.user.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-1 w-full rounded-md px-3 py-1.5 text-left text-sm text-muted transition hover:bg-raise hover:text-text"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function Shell() {
  return (
    <div className="flex min-h-full">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-8 py-8">
        {/* Wide, not narrow: the Library is a six-column table and the sidebar has
            already taken 240px. Capped only so an ultrawide monitor does not stretch
            rows to unreadable lengths. */}
        <div className="mx-auto max-w-[1500px]">
          <Routes>
            <Route path="/" element={<ComingSoon title="Dashboard" />} />
            <Route path="/library" element={<Library />} />
            <Route path="/tracks/:trackId" element={<TrackDetail />} />
            <Route path="/combos" element={<ComingSoon title="Combos" />} />
            <Route path="/log" element={<ComboLogger />} />
            <Route path="/suggestions" element={<ComingSoon title="Harmonic suggestions" />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/:sessionId" element={<SessionPlanner />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <p className="p-6 text-sm text-muted">Loading…</p>;
  }
  return session ? <Shell /> : <Login />;
}
