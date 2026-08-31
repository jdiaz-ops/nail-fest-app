"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The coral/salmon active-item pill from our previous ticketing platform's
// Box office settings sidebar — this is the one bit of that screen that needs to know
// the current route, so it's the only client component in this layout.
export default function SettingsNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "8px 12px",
        borderRadius: 8,
        fontSize: 14,
        color: "#1c1310",
        textDecoration: "none",
        background: active ? "#ffc5a8" : "transparent",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </Link>
  );
}
