import { requirePageUser } from "@/lib/auth/guard";
import WhatsAppInboxList from "@/components/WhatsAppInboxList";

export const dynamic = "force-dynamic";

// The split view WhatChimp's Shared Inbox uses and ours didn't: a
// persistent conversation list on the left, the open thread (or an empty
// state — see page.tsx) on the right, neither one ever unmounting the
// other. Next's layout-persistence-across-navigation is what makes this
// work — clicking between /bandeja/[id] routes only swaps {children},
// so WhatsAppInboxList (a client component, see its own comment) is never
// remounted or re-fetched from scratch just because you opened a chat.
//
// The fixed height (rather than letting the page grow and scroll like
// every other admin screen) is deliberate — a messaging inbox has to feel
// like an app, not a page you scroll through to find the reply box. The
// offset below is an estimate of the chrome above this panel (top nav +
// page padding + the CRM section header + the Conexión/Plantillas/
// Difusiones/Bandeja tab bar) — if it's off by a bit on some viewport the
// worst case is a little extra page scroll, not broken layout, since both
// panes scroll internally regardless.
export default async function BandejaLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["ADMIN"]);

  return (
    <div
      style={{
        display: "flex",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        height: "calc(100vh - 230px)",
        minHeight: 520,
        background: "var(--surface)",
      }}
    >
      <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid var(--border)" }}>
        <WhatsAppInboxList />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}
