"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The salmon/coral active-tab pill from Ticket Tailor's top nav
// ("Overview" highlighted in their screenshots) — same mechanism as
// /admin/settings/SettingsNavLink, one level up.
export default function AdminNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href);
  return (
    <Link
      href={href}
      style={{
        padding: "8px 16px",
        borderRadius: 999,
        fontSize: 14,
        textDecoration: "none",
        color: active ? "#1c1310" : "#e8e4dc",
        background: active ? "#f6c4b2" : "transparent",
        fontWeight: active ? 600 : 400,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}
