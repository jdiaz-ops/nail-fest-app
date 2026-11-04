import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { congressTimes, dayWords, readRecordings, talksOf } from "@/lib/imparables/grabaciones";
import { congresoSamplePath } from "@/lib/imparables/miCongreso";
import RecordingsForm from "./RecordingsForm";

export const dynamic = "force-dynamic";

// «Grabaciones» (the team, 2026-11-04: «pienso subirlas cada una individualmente en privado a YouTube y poder
// copiar/pegar el link ahí»): one row per talk — the program's talks the first time —, its YouTube link pasted, and
// the last day they can be watched. Each buyer sees them on her own recordings page (app/mi-congreso/[token]), from
// the congress's end to that day; the sample shows them as she will. ADMIN only, like the rest of Configuración.
export default async function RecordingsPage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);
  const [event, orgSettings] = await Promise.all([db.event.findUnique({ where: { id: params.id } }), getOrgSettings()]);
  if (!event || event.theme !== "IMPARABLES") notFound();
  const saved = readRecordings(event.recordings);
  const talks = talksOf(parseLandingBlocks(event.landingBlocks).filter((block) => !block.hidden));
  const times = congressTimes(event, { ...saved, until: null }, orgSettings.timezone);

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Grabaciones</h2>
      <p style={{ color: "#5b5f6b", marginTop: 0, maxWidth: 700 }}>
        Pega aquí el enlace de YouTube de cada charla. Cada compradora las ve en su página de grabaciones, con un enlace solo suyo, desde que termina el
        congreso hasta la fecha de abajo. Nadie más puede verlas desde aquí.{" "}
        <Link href={congresoSamplePath(event.id)} target="_blank">
          Ver la página de muestra ↗
        </Link>
      </p>

      <details style={{ margin: "12px 0 20px", padding: "12px 16px", border: "1px solid #e3e1dc", borderRadius: 12, background: "#faf9f7", maxWidth: 700 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Cómo subir cada video a YouTube</summary>
        <ol style={{ fontSize: 14, lineHeight: 1.55, margin: "10px 0 4px", paddingLeft: 20 }}>
          <li>En YouTube Studio, «Crear» → «Subir videos» y elige el video de la charla.</li>
          <li>
            En «Visibilidad», elige <strong>«No listado»</strong>. No «Privado»: un video privado solo lo ven las cuentas de Google que invites una por una
            (máximo 50), y a las demás les sale «Video privado».
          </li>
          <li>En «Mostrar más», deja marcada «Permitir inserción» (viene marcada): así el video se ve dentro de su página.</li>
          <li>Copia el enlace del video (youtu.be/…) y pégalo en su fila. Guarda.</li>
        </ol>
        <p style={{ fontSize: 13, color: "#5b5f6b", margin: "8px 0 0" }}>
          Un video «No listado» no aparece en YouTube ni en búsquedas: solo lo ve quien tiene el enlace, y el enlace solo está dentro de la página de
          grabaciones de cada compradora. Cuando pase la fecha de cierre, la página deja de mostrarlos; si quieres cerrarlos del todo, pásalos a «Privado» en YouTube.
        </p>
      </details>

      <RecordingsForm
        eventId={event.id}
        initialItems={saved.items.length ? saved.items : talks}
        talks={talks}
        initialUntil={saved.until}
        defaultUntil={times.recordingsUntil}
        defaultUntilWords={dayWords(times.recordingsUntil)}
        opensWords={dayWords(times.lastDay)}
        fromProgram={!saved.items.length}
      />
    </div>
  );
}
