import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import InfoPageForm from "../InfoPageForm";

export const dynamic = "force-dynamic";

export default async function NewInfoPagePage({ searchParams }: { searchParams: { eventId?: string } }) {
  await requirePageUser(["ADMIN"]);
  const events = await db.event.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, name: true, slug: true } });

  return (
    <div>
      <Link href="/admin/pages" style={{ fontSize: 13 }}>
        ← Páginas
      </Link>
      <h1 style={{ fontSize: 24, margin: "8px 0 20px" }}>Nueva página</h1>
      {events.length === 0 ? (
        <p style={{ color: "#5b5f6b" }}>Primero crea un evento: cada página pertenece a uno.</p>
      ) : (
        <InfoPageForm
          events={events}
          siteOrigin={(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}
          initial={{
            eventId: events.some((e) => e.id === searchParams.eventId) ? searchParams.eventId! : events[0]!.id,
            title: "",
            slug: "",
            intro: "",
            blocks: [],
            published: false,
            showRegisterButton: true,
            showTopRegisterButton: false,
          }}
        />
      )}
    </div>
  );
}
