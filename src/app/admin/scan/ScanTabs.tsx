"use client";

import Link from "next/link";

// Admin-only sub-nav within the scanner section (see admin/scan/page.tsx —
// staff never renders this at all, so it never even has to explain why
// there's a tab it can't use). Plain <Link>s, not a client-side pill
// component with usePathname — `active` is just passed straight from
// whichever page renders it, since there are only ever two possible pages.
export default function ScanTabs({ active }: { active: "scan" | "stats" }) {
  const tabs: { key: "scan" | "stats"; href: string; label: string }[] = [
    { key: "scan", href: "/admin/scan", label: "Escanear" },
    { key: "stats", href: "/admin/scan/stats", label: "Estadísticas" },
  ];
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #e3e1dc" }}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          style={{
            padding: "8px 4px",
            marginRight: 20,
            fontSize: 14,
            textDecoration: "none",
            color: tab.key === active ? "var(--ink)" : "#5b5f6b",
            fontWeight: tab.key === active ? 600 : 400,
            borderBottom: tab.key === active ? "2px solid var(--accent)" : "2px solid transparent",
          }}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
