import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Xfade</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Sign in to your library.
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            value={password}
            required
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
