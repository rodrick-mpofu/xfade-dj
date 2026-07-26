/**
 * Inline SVGs rather than an icon package.
 *
 * Six icons do not justify a dependency, and inlining keeps them themeable with
 * `currentColor` and free of a runtime.
 */

type IconProps = { className?: string };

const base = "size-[18px] shrink-0";

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${base} ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

export function SetlistIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6h11M3 12h11M3 18h7" />
      <circle cx="18" cy="16" r="2.5" />
      <path d="M20.5 16V8l1.5.6" />
    </Svg>
  );
}

export function ComboIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 4h4v4M20 4l-6.5 6.5M4 20l6.5-6.5M16 20h4v-4M4 4l16 16" opacity="0" />
      <path d="M3 7h4l10 10h4" />
      <path d="M18 4l3 3-3 3" />
      <path d="M3 17h4l3-3" />
      <path d="M18 20l3-3-3-3" />
    </Svg>
  );
}

export function SessionIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 15.5a5 5 0 0 0 0-7" />
      <path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 18.5a9 9 0 0 0 0-13" />
    </Svg>
  );
}

export function SuggestionsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
    </Svg>
  );
}

export function XfadeMark({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      className={className ?? "size-5 shrink-0"}
    >
      <circle cx="12" cy="12" r="2" />
      <path d="M8 8.5a5 5 0 0 0 0 7M16 15.5a5 5 0 0 0 0-7" />
      <path d="M4.5 5a10 10 0 0 0 0 14M19.5 19a10 10 0 0 0 0-14" />
    </svg>
  );
}
