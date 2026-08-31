import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Backs the persistent conversation list in bandeja/layout.tsx — that
// list is a client component (it has to survive navigating between
// threads without remounting, and polls for freshness), so it needs its
// own JSON endpoint instead of reading straight from a Server Component
// the way the rest of the admin does. Shape mirrors what the old
// bandeja/page.tsx used to query inline before this became a layout.
export async function GET(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const filter = req.nextUrl.searchParams.get("filter");
  const where =
    filter === "unread"
      ? { unreadCount: { gt: 0 } }
      : filter === "mine"
      ? { assignedToId: auth.user.id }
      : undefined;

  const conversations = await db.whatsAppConversation.findMany({
    where,
    orderBy: [{ lastInboundAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      person: true,
      assignedTo: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => {
      const last = c.messages[0];
      const withinWindow = Boolean(c.lastInboundAt && Date.now() - c.lastInboundAt.getTime() < WINDOW_MS);
      return {
        id: c.id,
        phone: c.phone,
        name: c.person
          ? [c.person.firstName, c.person.lastName].filter(Boolean).join(" ") || c.person.email
          : null,
        assignedToLabel: c.assignedTo ? c.assignedTo.name || c.assignedTo.username : null,
        unreadCount: c.unreadCount,
        withinWindow,
        // Escalated by the AI agent (or taken over by a human reply) but
        // nobody's actually claimed it yet — the one state that needs a
        // human to notice on their own, since neither "unread" nor
        // "assigned to me" necessarily catches it.
        waitingForHuman: !c.aiAutoReplyEnabled && !c.assignedToId,
        lastMessage: last
          ? { body: last.body, direction: last.direction, createdAt: last.createdAt.toISOString() }
          : null,
        lastActivityAt: (c.lastInboundAt ?? c.updatedAt).toISOString(),
      };
    }),
  });
}
