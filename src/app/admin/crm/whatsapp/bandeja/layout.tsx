import { requirePageUser } from "@/lib/auth/guard";
import WhatsAppInboxList from "@/components/WhatsAppInboxList";
import BandejaShell from "./BandejaShell";

export const dynamic = "force-dynamic";

// The split view WhatChimp's Shared Inbox uses and ours didn't: a
// persistent conversation list on the left, the open thread (or an empty
// state — see page.tsx) on the right, neither one ever unmounting the
// other. Next's layout-persistence-across-navigation is what makes this
// work — clicking between /bandeja/[id] routes only swaps {children},
// so WhatsAppInboxList (a client component, see its own comment) is never
// remounted or re-fetched from scratch just because you opened a chat.
//
// The actual pane layout (fixed-width list/sidebar side by side, and the
// responsive collapse to one pane at a time below 900px) lives in
// globals.css's .wa-bandeja-shell rules and BandejaShell.tsx — this file
// stays a server component only for the requirePageUser check.
export default async function BandejaLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["ADMIN", "COORDINADOR"]);

  return <BandejaShell list={<WhatsAppInboxList />}>{children}</BandejaShell>;
}
