import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 font-semibold",
  ghost: "border border-edge text-text hover:bg-raise",
  danger: "border border-rose-900/70 text-rose-400 hover:bg-rose-950/40",
};

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm
        transition disabled:cursor-not-allowed disabled:opacity-40
        ${VARIANTS[variant]} ${className}`}
    />
  );
}
