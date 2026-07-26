import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-edge bg-panel ${className}`}>{children}</div>
  );
}

export function PanelHeading({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 px-5 pt-5 pb-1 text-base font-semibold">
      {icon && <span className="text-accent">{icon}</span>}
      {children}
    </h2>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-edge p-10 text-center text-sm text-muted">
      {children}
    </p>
  );
}
