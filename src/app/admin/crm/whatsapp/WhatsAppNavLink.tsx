"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Horizontal sub-tabs for the WhatsApp section — a third sidebar level
// (CRM → WhatsApp → Conexión as nested lists) would be one nesting too
// many next to CrmNavLink's own sidebar, so this is a tab row across the
// top of the content pane instead, same active-prefix logic as
// CrmNavLink/SettingsNavLink.
export default function WhatsAppNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        padding: "8px 14px",
        borderRadius: 999,
        fontSize: 14,
        color: active ? "#1c1310" : "#5b5f6b",
        textDecoration: "none",
        background: active ? "#ffc5a8" : "transparent",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </Link>
  );
}
