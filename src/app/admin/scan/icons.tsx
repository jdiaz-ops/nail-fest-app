// Small hand-authored stroke-icon set (Feather-style), matching the one
// already established for the person-timeline page — plain JSX, not
// markup built from any dynamic/user string.
const common = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

export function ScannerIcon() {
  return (
    <svg {...common}>
      <path d="M4 7V5a1 1 0 011-1h2M20 7V5a1 1 0 00-1-1h-2M4 17v2a1 1 0 001 1h2M20 17v2a1 1 0 01-1 1h-2" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 21v-1a7 7 0 0114 0v1" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg {...common} width={22} height={22}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function CheckCircleIcon({ filled }: { filled: boolean }) {
  return (
    <svg {...common} width={22} height={22} style={{ color: filled ? "#0e6b4c" : "#c9c5ba" }}>
      <circle cx="12" cy="12" r="9" />
      {filled && <path d="M8.5 12.5l2.5 2.5 5-5" />}
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg {...common} width={18} height={18}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
