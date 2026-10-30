import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { versionEditorProps } from "@/lib/imparables/versionsEditor";
import VersionEditor from "@/components/VersionEditor";

export const dynamic = "force-dynamic";

export default async function LandingVersionPage({ params }: { params: { id: string; versionId: string } }) {
  await requirePageUser(["ADMIN"]);
  const version = await db.landingVersion.findUnique({ where: { id: params.versionId }, include: { event: true } });
  if (!version || version.eventId !== params.id) notFound();
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 13 }}>
        <Link href={`/admin/events/${version.eventId}/versiones`}>← Versiones de la landing</Link>
      </p>
      <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>{version.name}</h1>
      <p style={{ color: "#5b5f6b", margin: "0 0 18px", maxWidth: 680 }}>
        Lo que dejes vacío sale igual que en la página principal. Conferencistas, agenda y preguntas siempre son los de la principal: los editas una sola vez.
      </p>
      <VersionEditor {...await versionEditorProps(version.event, version)} />
    </div>
  );
}
