import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { getActiveStage } from "@/lib/imparables/pricing";
import { pesos } from "@/lib/imparables/stages";
import { specialPricesOf, versionUrl } from "@/lib/imparables/versions";
import { versionNumbers, type VersionNumbers } from "@/lib/imparables/versionsAdmin";
import { isTieredVersion } from "@/lib/imparables/tiers";
import { tierStats, type TierStats } from "@/lib/imparables/tiersServer";
import { eliteWaitlistLabel } from "@/lib/imparables/waitlist";
import CopyLinkButton from "@/components/CopyLinkButton";

export const dynamic = "force-dynamic";

const secondary: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e3e1dc",
  borderRadius: 8,
  color: "#17181c",
  fontWeight: 600,
  cursor: "pointer",
  padding: "6px 12px",
  fontSize: 13,
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const chip: React.CSSProperties = { fontSize: 12.5, padding: "3px 10px", borderRadius: 6, background: "#f0efec" };
const pill = (tone: "ok" | "off" | "wait" | "base"): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 700,
  padding: "2px 9px",
  borderRadius: 999,
  ...{ ok: { color: "#1f7a4d", background: "#e6f4ec" }, off: { color: "#6b6f7a", background: "#eceae6" }, wait: { color: "#8a5a00", background: "#fdf1d8" }, base: { color: "#0b2e2c", background: "#dff5f3" } }[tone],
});

function Numbers({ n }: { n: VersionNumbers }) {
  const cells: [string, React.ReactNode][] = [
    ["Visitas", n.visits.toLocaleString("es-CO")],
    ["Abrieron el checkout", n.checkouts.toLocaleString("es-CO")],
    [
      "Ventas",
      <>
        {n.sales.toLocaleString("es-CO")}
        {n.visits > 0 && <small style={{ fontSize: 12, color: "#5b5f6b", marginLeft: 4, fontWeight: 400 }}>{((n.sales / n.visits) * 100).toFixed(1).replace(".", ",")}%</small>}
      </>,
    ],
    ["Ingresos", <>{pesos(n.revenueCop)}{n.revenueUsdCents > 0 && <small style={{ fontSize: 12, color: "#5b5f6b", marginLeft: 4, fontWeight: 400 }}>+ US${(n.revenueUsdCents / 100).toLocaleString("es-CO")}</small>}</>],
    ["Carritos abandonados", n.abandoned.toLocaleString("es-CO")],
  ];
  return (
    <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", borderTop: "1px solid #e3e1dc", paddingTop: 12, gap: 10 }}>
      {cells.map(([label, value]) => (
        <div key={label}>
          <div style={{ fontSize: 11.5, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/** A version that sells the ticket levels (lib/imparables/tiers.ts, 2026-10-31): each level's sales and income, Élite's
 * places and waiting list, and how many moved up. */
function TierNumbers({ t, label }: { t: TierStats; label: string }) {
  return (
    <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #e3e1dc", paddingTop: 12 }}>
      <div style={{ fontSize: 11.5, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Por nivel</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13.5, fontVariantNumeric: "tabular-nums", minWidth: 360 }}>
          <thead>
            <tr style={{ color: "#5b5f6b", textAlign: "left" }}>
              <th style={{ padding: "4px 16px 4px 0", fontWeight: 600 }}>Nivel</th>
              <th style={{ padding: "4px 16px 4px 0", fontWeight: 600 }}>Vendidas</th>
              <th style={{ padding: "4px 0", fontWeight: 600 }}>Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((row) => (
              <tr key={row.tier.slug} style={{ borderTop: "1px solid #f0efec" }}>
                <td style={{ padding: "5px 16px 5px 0", fontWeight: 600 }}>{row.tier.name}</td>
                <td style={{ padding: "5px 16px 5px 0" }}>{row.sold.toLocaleString("es-CO")}</td>
                <td style={{ padding: "5px 0" }}>{pesos(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {t.eliteLeft !== null && (
          <span style={{ ...chip, ...(t.eliteLeft === 0 ? { background: "#fbefd9", color: "#6e4a12" } : {}) }}>
            {t.eliteLeft === 0 ? "Élite agotada" : <>Cupos Élite: quedan <b>{t.eliteLeft}</b></>}
          </span>
        )}
        <span style={chip}>
          Lista de espera Élite: <b>{t.eliteWaitlist}</b>
        </span>
        <span style={chip}>
          Se pasaron de nivel: <b>{t.upgrades}</b>
        </span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#5b5f6b" }}>
        Cada compra cuenta en el nivel que tiene hoy, con todo lo que pagó en pesos: su compra y, si se pasó de nivel, la diferencia. La lista de espera Élite
        está en el CRM con la etiqueta «{label}».
      </p>
    </div>
  );
}

// «Versiones de la landing» (2026-10-30, lib/imparables/versions.ts): the
// event's main page and each version of it — its link, what it changes,
// whether it's on, its QR — with their numbers side by side.
export default async function LandingVersionsPage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();
  const [versions, orgSettings, types, sales] = await Promise.all([
    db.landingVersion.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "asc" } }),
    getOrgSettings(),
    db.ticketType.findMany({ where: { eventId: event.id }, select: { id: true, name: true } }),
    getActiveStage(event),
  ]);
  const numbers = await versionNumbers(event, versions);
  const waitlistLabel = eliteWaitlistLabel(event);
  const tiers = new Map(
    await Promise.all(versions.filter((v) => isTieredVersion(v.slug)).map(async (v) => [v.id, await tierStats(event.id, v.id, waitlistLabel)] as const))
  );
  const now = new Date();
  const day = (d: Date) => formatDateInTz(d, { day: "numeric", month: "short" }, orgSettings.timezone, orgSettings.language);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const main = versionUrl(event.slug, null);

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Versiones de la landing</h1>
          <p style={{ color: "#5b5f6b", margin: "6px 0 0", maxWidth: 680 }}>
            La misma página, el mismo checkout y las mismas inscritas, con otro enlace. Cada versión puede cambiar la portada y tener un precio especial que no
            aparece en ningún otro lado.
          </p>
        </div>
        <Link href={`/admin/events/${event.id}/versiones/nueva`} style={{ whiteSpace: "nowrap", padding: "10px 18px", borderRadius: 8, background: "#00beb5", color: "#0b2e2c", fontWeight: 600, textDecoration: "none" }}>
          + Nueva versión
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
        <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: "16px 18px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "12px 24px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 700 }}>
              Página principal <span style={pill("base")}>Principal</span>
            </div>
            <div style={{ marginTop: 3, fontSize: 13.5, color: "#007a74", fontFamily: "ui-monospace, Menlo, monospace" }}>{main.replace(/^https?:\/\//, "")}</div>
            {sales.current && (
              <div style={{ marginTop: 8 }}>
                <span style={chip}>
                  Precio de la etapa: <b>{pesos(sales.current.price)}</b>
                </span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <a href={`/api/admin/events/${event.id}/versions/principal/qr?formato=png`} style={secondary}>
              Descargar QR
            </a>
            <CopyLinkButton url={main} style={secondary} />
          </div>
          <Numbers n={numbers.get("main")!} />
        </div>

        {versions.map((v) => {
          const prices = Object.entries(specialPricesOf(v));
          const ownCover = Boolean(v.title || v.subtitle || v.imageUrl || v.buttonLabel);
          const ended = v.endsAt !== null && v.endsAt <= now;
          const status = !v.enabled
            ? { text: "Pausada", tone: "off" as const }
            : ended
            ? { text: `Venció el ${day(v.endsAt!)}`, tone: "off" as const }
            : v.startsAt && v.startsAt > now
            ? { text: `Empieza el ${day(v.startsAt)}`, tone: "wait" as const }
            : { text: v.endsAt ? `Activa · hasta el ${day(v.endsAt)}` : "Activa", tone: "ok" as const };
          const n = numbers.get(v.id)!;
          const url = versionUrl(event.slug, v.slug);
          return (
            <div key={v.id} style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: "16px 18px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "12px 24px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 16, fontWeight: 700 }}>
                  {v.name} <span style={pill(status.tone)}>{status.text}</span>
                </div>
                <div style={{ marginTop: 3, fontSize: 13.5, color: "#007a74", fontFamily: "ui-monospace, Menlo, monospace" }}>{url.replace(/^https?:\/\//, "")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {prices.map(([typeId, price]) => (
                    <span key={typeId} style={{ ...chip, background: "#fbefd9", color: "#6e4a12" }}>
                      Precio especial: <b>{pesos(price)}</b> en {typeName.get(typeId) ?? "una etapa"}
                    </span>
                  ))}
                  {ownCover && <span style={chip}>Portada propia</span>}
                  {prices.length === 0 && <span style={chip}>Precio normal</span>}
                  {prices.length > 0 && v.maxSpecialSales !== null && (
                    <span style={chip}>
                      Máx. {v.maxSpecialSales} a este precio · van {n.specialSold}
                    </span>
                  )}
                </div>
                {(ended || !v.enabled) && (
                  <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#5b5f6b" }}>
                    {ended ? "Ya venció" : "Está pausada"}: quien abra su enlace o escanee su QR llega a la página principal, con el precio normal.
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <a href={`/api/admin/events/${event.id}/versions/${v.id}/qr?formato=png`} style={secondary}>
                  Descargar QR
                </a>
                <CopyLinkButton url={url} style={secondary} />
                <Link href={`/admin/events/${event.id}/versiones/${v.id}`} style={secondary}>
                  Editar
                </Link>
              </div>
              <Numbers n={n} />
              {tiers.has(v.id) && <TierNumbers t={tiers.get(v.id)!} label={waitlistLabel} />}
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px dashed #e3e1dc", fontSize: 13, color: "#5b5f6b" }}>
        Las ventas a precio especial no cuentan en los cupos de su etapa. Cada venta queda marcada con la versión de donde vino: en Segmentos puedes armar
        «compró desde esta versión».
      </p>
    </div>
  );
}
