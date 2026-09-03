"use client";

import { usePathname } from "next/navigation";

// Split out of layout.tsx (a server component, for the requirePageUser
// check) purely because this needs the current pathname to know whether
// a conversation is open — that's client-only info. See globals.css's
// own .wa-bandeja-shell comment for why this exists at all: below 900px,
// showing the list AND the thread AND the thread's own sidebar side by
// side (the desktop shape, unchanged above 900px) has no room to fit and
// breaks. This shows exactly one pane at a time on mobile instead.
export default function BandejaShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  // Exactly "/admin/crm/whatsapp/bandeja" (no [id] segment) — the empty
  // "Selecciona una conversación" state — means no thread is open yet, so
  // mobile should show the list. Any nested path means a conversation IS
  // open, so mobile should show that instead.
  const listOnly = pathname === "/admin/crm/whatsapp/bandeja";

  return (
    <div className="wa-bandeja-shell">
      <div className={`wa-bandeja-list-pane${listOnly ? "" : " wa-bandeja-list-pane-hide-mobile"}`}>{list}</div>
      <div className={`wa-bandeja-thread-pane${listOnly ? " wa-bandeja-thread-pane-hide-mobile" : ""}`}>{children}</div>
    </div>
  );
}
