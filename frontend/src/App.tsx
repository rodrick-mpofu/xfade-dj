import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Library } from "./routes/Library";
import { Login } from "./routes/Login";
import { TrackDetail } from "./routes/TrackDetail";

/** Placeholder until build spec §7 steps 8 and 9. */
function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Not built yet.</p>
    </div>
  );
}

const NAV = [
  { to: "/", label: "Library", end: true },
  { to: "/log", label: "Log a combo" },
  { to: "/sessions", label: "Sessions" },
];

function Shell() {
  const { signOut, session } = useAuth();

  return (
    <div className="min-h-full">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <span className="text-lg font-semibold tracking-tight">Xfade</span>
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm ${
                    isActive
                      ? "bg-neutral-100 font-medium dark:bg-neutral-800"
                      : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-neutral-500">
            <span className="hidden sm:inline">{session?.user.email}</span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/tracks/:trackId" element={<TrackDetail />} />
          <Route path="/log" element={<ComingSoon title="Combo logger" />} />
          <Route path="/sessions" element={<ComingSoon title="Session planner" />} />
          <Route path="*" element={<ComingSoon title="Not found" />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
  }
  return session ? <Shell /> : <Login />;
}
