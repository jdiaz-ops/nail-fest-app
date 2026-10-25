"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The salmon/coral active-tab pill from our previous ticketing platform's
// top nav ("Overview" highlighted in its screenshots) — same mechanism as
// /admin/settings/SettingsNavLink, one level up. `also`: the sections that
// live under this one (Proyectos' cuponera, instructors and reviews), so it
// stays lit inside them.
export default function AdminNavLink({ href, label, also = [] }: { href: string; label: string; also?: string[] }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : [href, ...also].some((prefix) => pathname?.startsWith(prefix));
  return (
    <Link
      href={href}
      style={{
        padding: "8px 16px",
        borderRadius: 999,
        fontSize: 14,
        textDecoration: "none",
        color: active ? "#1c1310" : "#e8e4dc",
        background: active ? "#ffc5a8" : "transparent",
        fontWeight: active ? 600 : 400,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}
