"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// CRM → Broadcasts in two parts (2026-10-25): the emails to a segment, and
// La Mesa, the newsletter — one place for everything that's emailed.
const TABS = [
  { href: "/admin/crm/broadcasts", label: "Correos" },
  { href: "/admin/crm/broadcasts/la-mesa", label: "La Mesa" },
];

export default function BroadcastTabs() {
  const pathname = usePathname() ?? "";
  const current = pathname.startsWith("/admin/crm/broadcasts/la-mesa") ? TABS[1]!.href : TABS[0]!.href;
  return (
    <nav aria-label="Broadcasts" style={{ display: "flex", gap: 4, marginBottom: 22, borderBottom: "1px solid #e3e1dc" }}>
      {TABS.map((tab) => {
        const on = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            style={{
              padding: "8px 14px",
              marginBottom: -1,
              borderBottom: `2px solid ${on ? "#17181c" : "transparent"}`,
              fontSize: 14,
              fontWeight: on ? 700 : 500,
              color: on ? "#17181c" : "#5b5f6b",
              textDecoration: "none",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
