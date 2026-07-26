import { useState, type FormEvent } from "react";
import { XfadeMark } from "../components/Icons";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/auth";

const FIELD =
  "mt-1 block w-full rounded-md border border-edge bg-panel px-3 py-2 text-sm focus:border-accent focus:outline-none";

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
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <div className="flex items-center gap-2 text-accent">
          <XfadeMark className="size-7" />
          <span className="text-2xl font-bold tracking-[0.2em]">XFADE</span>
        </div>
        <p className="text-sm text-muted">Sign in to your library.</p>

        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD}
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
            className={FIELD}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={busy} className="w-full py-2">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
