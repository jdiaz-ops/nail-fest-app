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
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const filter = req.nextUrl.searchParams.get("filter");
  const tabWhere =
    filter === "unread"
      ? { unreadCount: { gt: 0 } }
      : filter === "mine"
      ? { assignedToId: auth.user.id }
      : {};
  // ?q= — a name, an email or a phone (any spelling: "+57 300…",
  // "300 123 4567"; digits are compared on their own). A query with no
  // digits searches the person's names and email; with digits, the phone
  // too.
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const digits = q.replace(/\D/g, "");
  const searchWhere = q
    ? {
        OR: [
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          { person: { firstName: { contains: q, mode: "insensitive" as const } } },
          { person: { lastName: { contains: q, mode: "insensitive" as const } } },
          { person: { email: { contains: q, mode: "insensitive" as const } } },
          // "Karen Mora": first name + last name typed together
          ...(q.includes(" ")
            ? [{ person: { AND: [{ firstName: { contains: q.split(/\s+/)[0]!, mode: "insensitive" as const } }, { lastName: { contains: q.split(/\s+/).slice(1).join(" "), mode: "insensitive" as const } }] } }]
            : []),
        ],
      }
    : {};
  const where = { ...tabWhere, ...searchWhere };

  // select, not include — this list only ever renders a handful of
  // fields per row, but this endpoint is polled every 30s the whole time
  // the Bandeja is open (see WhatsAppInboxList.tsx). `include: { person:
  // true }` was pulling every column on `person` (all the phone/consent
  // fields from the CRM cleanup) on every single poll — real, continuous
  // Postgres egress for data this list never displays.
  const conversations = await db.whatsAppConversation.findMany({
    where,
    orderBy: [{ lastInboundAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      phone: true,
      unreadCount: true,
      lastInboundAt: true,
      updatedAt: true,
      person: { select: { firstName: true, lastName: true, email: true } },
      assignedTo: { select: { name: true, username: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, direction: true, createdAt: true } },
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
        lastMessage: last
          ? { body: last.body, direction: last.direction, createdAt: last.createdAt.toISOString() }
          : null,
        lastActivityAt: (c.lastInboundAt ?? c.updatedAt).toISOString(),
      };
    }),
  });
}
