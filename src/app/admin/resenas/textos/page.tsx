import Link from "next/link";
import { Fraunces } from "next/font/google";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getReviewTextOverrides } from "@/lib/reviewPageTexts";
import { previewReviewToken } from "@/lib/reviews";
import ReviewTextsForm from "./ReviewTextsForm";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"] });

export const dynamic = "force-dynamic";

// /admin/resenas/textos — every line of the attendee's review pages
// (lib/reviewPageTexts.ts), with links to see them as she does.
export default async function ReviewTextsPage() {
  await requirePageUser(["ADMIN", "COORDINADOR"]);
  const overrides = await getReviewTextOverrides();
  // A token to preview with: the most recent event that has one.
  const recent = await db.event.findMany({ orderBy: { startsAt: "desc" }, take: 6, select: { id: true } });
  let token: string | null = null;
  for (const e of recent) {
    token = await previewReviewToken(e.id);
    if (token) break;
  }
  const previewHrefs = token ? { form: `/resena/${encodeURIComponent(token)}?vista=formulario`, thanks: `/resena/${encodeURIComponent(token)}?vista=gracias` } : null;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <Link href="/admin/resenas">← Reseñas</Link>
        </div>
        <h1 className={fraunces.className} style={{ fontWeight: 900, fontSize: 28, margin: "0 0 4px" }}>
          Textos de la página de reseña
        </h1>
        <p style={{ color: "#5b5f6b", margin: 0, maxWidth: 760 }}>
          Lo que lee la asistente en su enlace personal, en el formulario y en la pantalla de gracias. Los cambios aplican a todos los eventos; <code>{"{{evento}}"}</code>, <code>{"{{nombre}}"}</code>, <code>{"{{premios}}"}</code> y <code>{"{{fecha}}"}</code> se rellenan solos con los datos de cada una.
          {!previewHrefs && " Para verla como la asistente, crea las reseñas de muestra en la pestaña Reseñas de un evento."}
        </p>
      </div>
      <ReviewTextsForm overrides={overrides} previewHrefs={previewHrefs} />
    </div>
  );
}
