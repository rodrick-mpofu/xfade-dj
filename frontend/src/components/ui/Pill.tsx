import type { ReactNode } from "react";

/**
 * Small bordered chip for a single fact — a Camelot key, a genre, a BPM.
 *
 * `tone="key"` is monospaced because Camelot codes are compared far more often than
 * they are read: 8A against 9A only jumps out when the glyphs line up.
 */
export function Pill({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "key" | "accent";
}) {
  const tones = {
    plain: "bg-raise text-muted",
    key: "bg-raise text-text font-mono",
    accent: "bg-accent/10 text-accent",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Seconds to m:ss. Durations are read as clock time, never as a decimal. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "—";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
