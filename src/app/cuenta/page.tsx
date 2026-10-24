import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CommunityShell from "@/components/community/CommunityShell";
import { MemberAccountForm } from "@/components/community/MemberForms";
import { db } from "@/lib/db";
import { getConsultorioIdentity } from "@/lib/community/auth";
import { visibleAnswer } from "@/lib/community/data";
import { INSIGNIA, earnsInsignia } from "@/lib/community/consultorio";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mi cuenta · Nail Fest", robots: { index: false, follow: false } };

// nailfest.lat/cuenta — her community account: how she's helping in the
// Consultorio (and what's left for the insignia), and her details.
export default async function CuentaPage() {
  const identity = await getConsultorioIdentity();
  if (identity?.kind !== "MEMBER") redirect("/cuenta/entrar?volver=/cuenta");
  const { member } = identity;
  const [questions, answers, useful, best] = await Promise.all([
    db.consultorioQuestion.count({ where: { memberId: member.id, hidden: false } }),
    db.consultorioAnswer.count({ where: { memberId: member.id, ...visibleAnswer } }),
    db.consultorioAnswer.aggregate({ where: { memberId: member.id, hidden: false }, _sum: { usefulCount: true } }),
    db.consultorioQuestion.count({ where: { hidden: false, bestAnswer: { memberId: member.id, hidden: false } } }),
  ]);
  const usefulCount = useful._sum.usefulCount ?? 0;
  const insignia = earnsInsignia({ best, useful: usefulCount });

  return (
    <CommunityShell section="Mi cuenta" identity={identity} returnTo="/cuenta">
      <div className="cs-wrap">
        <h1 className={`cs-h1 ${fraunces.className}`}>Hola, {member.name.split(" ")[0]}</h1>
        <div className="pt-card">
          <h2 className="pt-h3">Tu ayuda en el Consultorio</h2>
          <p>
            {questions === 1 ? "1 pregunta" : `${questions} preguntas`} · {answers === 1 ? "1 respuesta" : `${answers} respuestas`} · {usefulCount} «Me sirvió» ·{" "}
            {best === 1 ? "1 marcada como la que resolvió" : `${best} marcadas como la que resolvió`}
          </p>
          {insignia ? (
            <span className="cs-pill cs-pill--insignia">Tienes la insignia «{INSIGNIA.label}»</span>
          ) : (
            <span className="pt-hint">
              La insignia «{INSIGNIA.label}» llega con {INSIGNIA.bestFrom} respuestas marcadas como la que resolvió, o con {INSIGNIA.usefulFrom} «Me sirvió».
            </span>
          )}
          <Link href="/consultorio" className="bib-btn bib-btn-main bib-btn-sm">
            Ir al Consultorio
          </Link>
        </div>
        <MemberAccountForm name={member.name} city={member.city} email={member.email} />
      </div>
    </CommunityShell>
  );
}
