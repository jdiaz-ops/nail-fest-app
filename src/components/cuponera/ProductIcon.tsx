import type { ProductIconKind } from "@/lib/cuponera/shared";

// Stand-in for a product photo in the preview: a line drawing in the
// product's own color. Real products bring their photo instead.
export default function ProductIcon({ kind, color, size = 66 }: { kind: ProductIconKind; color: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#17181c",
    strokeWidth: 1.3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "bottle":
      return (
        <svg {...common}>
          <rect x="9" y="2.5" width="6" height="5" rx="1" fill="#17181c" />
          <path d="M7 8.5h10l.8 11a2 2 0 0 1-2 2.1H8.2a2 2 0 0 1-2-2.1z" fill={color} />
        </svg>
      );
    case "drop":
      return (
        <svg {...common}>
          <path d="M12 3c3.5 4.4 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 2.5-6.6 6-11z" fill={color} />
        </svg>
      );
    case "tips":
      return (
        <svg {...common}>
          <path d="M8 4c-2 0-3 1.8-3 4v8.5a3 3 0 0 0 6 0V8c0-2.2-1-4-3-4z" fill={color} />
          <path d="M16 4c-2 0-3 1.8-3 4v8.5a3 3 0 0 0 6 0V8c0-2.2-1-4-3-4z" fill={color} />
        </svg>
      );
    case "lamp":
      return (
        <svg {...common}>
          <path d="M3 19h18" />
          <path d="M5 19c0-5.5 3.1-9.5 7-9.5s7 4 7 9.5" fill="#ffffff" />
          <path d="M9 16.5h6" />
          <path d="M12 6V4M7.5 7.5 6.3 6.3M16.5 7.5l1.2-1.2" />
        </svg>
      );
    case "brush":
      return (
        <svg {...common}>
          <path d="M4 20c1.5 0 3-.5 4-1.5l9.5-9.5-2.5-2.5L5.5 16C4.5 17 4 18.5 4 20z" fill={color} />
          <path d="m15 6.5 2-2 2.5 2.5-2 2" />
        </svg>
      );
    case "kit":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="12" rx="2" fill={color} />
          <path d="M8 8V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V8" />
          <path d="M3 13h18" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <rect x="2.5" y="10" width="19" height="4.5" rx="2.25" transform="rotate(-35 12 12)" fill={color} />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="m12 3 2.2 5.6 5.8.7-4.5 3.9 1.4 5.8L12 16l-4.9 3 1.4-5.8L4 9.3l5.8-.7z" fill={color} />
        </svg>
      );
    case "drill":
      return (
        <svg {...common}>
          <rect x="2.5" y="9" width="13" height="6" rx="3" fill={color} />
          <path d="M15.5 12h4.5M20 10.5v3" />
        </svg>
      );
  }
}
