import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import InfoPageForm from "../InfoPageForm";

export const dynamic = "force-dynamic";

export default async function EditInfoPagePage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);
  const [page, events] = await Promise.all([
    db.infoPage.findUnique({ where: { id: params.id } }),
    db.event.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, name: true, slug: true } }),
  ]);
  if (!page) notFound();

  return (
    <div>
      <Link href="/admin/pages" style={{ fontSize: 13 }}>
        ← Páginas
      </Link>
      <h1 style={{ fontSize: 24, margin: "8px 0 20px" }}>{page.title}</h1>
      <InfoPageForm
        events={events}
        siteOrigin={(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}
        initial={{
          id: page.id,
          eventId: page.eventId,
          title: page.title,
          slug: page.slug,
          intro: page.intro,
          blocks: parseLandingBlocks(page.blocks),
          published: page.published,
          showRegisterButton: page.showRegisterButton,
        }}
      />
    </div>
  );
}
