"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Same mechanism as SettingsNavLink one level up — the coral active pill.
export default function CrmNavLink({ href, label }: { href: string; label: string }) {
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
