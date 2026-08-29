import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonProfile, LIFECYCLE_LABEL, type LifecycleStage, type TimelineItem } from "@/lib/personTimeline";

export const dynamic = "force-dynamic";

const STAGE_BADGE: Record<LifecycleStage, { bg: string; ink: string }> = {
  LEAD: { bg: "#f6f5f2", ink: "#5b5f6b" },
  REGISTRADO: { bg: "#f6f5f2", ink: "#5b5f6b" },
  ASISTIO: { bg: "#e8f6ef", ink: "#0e6b4c" },
  RECURRENTE: { bg: "#e3faf7", ink: "var(--accent-ink)" },
  INACTIVO: { bg: "#fdf1e6", ink: "#8a5a1f" },
};

const TYPE_ICON: Record<TimelineItem["type"], { bg: string; ink: string }> = {
  REGISTRATION: { bg: "#e3faf7", ink: "var(--accent-ink)" },
  SCAN: { bg: "#e8f6ef", ink: "#0e6b4c" },
  CONSENT: { bg: "#f6f5f2", ink: "#5b5f6b" },
  META_EVENT: { bg: "#f6f5f2", ink: "#5b5f6b" },
  EMAIL_SENT: { bg: "#f6f5f2", ink: "#5b5f6b" },
  EMAIL_DELIVERED: { bg: "#f6f5f2", ink: "#5b5f6b" },
  EMAIL_OPENED: { bg: "#e3faf7", ink: "var(--accent-ink)" },
  EMAIL_CLICKED: { bg: "#e3faf7", ink: "var(--accent-ink)" },
  EMAIL_BOUNCED: { bg: "#fbe9ea", ink: "#a3212b" },
  EMAIL_COMPLAINED: { bg: "#fbe9ea", ink: "#a3212b" },
};

// Small hand-authored stroke-icon set (Feather-style), one per timeline
// event type — plain JSX, not markup built from any dynamic/user string.
function TimelineIcon({ type }: { type: TimelineItem["type"] }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "REGISTRATION":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 5-5" />
        </svg>
      );
    case "SCAN":
      return (
        <svg {...common}>
          <path d="M4 7V5a1 1 0 011-1h2M20 7V5a1 1 0 00-1-1h-2M4 17v2a1 1 0 001 1h2M20 17v2a1 1 0 01-1 1h-2" />
        </svg>
      );
    case "CONSENT":
      return (
        <svg {...common}>
          <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "META_EVENT":
      return (
        <svg {...common}>
          <path d="M7 17L17 7" />
          <path d="M7 7h10v10" />
        </svg>
      );
    case "EMAIL_SENT":
      return (
        <svg {...common}>
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      );
    case "EMAIL_DELIVERED":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
    case "EMAIL_OPENED":
      return (
        <svg {...common}>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "EMAIL_CLICKED":
      return (
        <svg {...common}>
          <path d="M9 3l9 9-4 1 3 5-2 1-3-5-3 3V3z" />
        </svg>
      );
    case "EMAIL_BOUNCED":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </svg>
      );
    case "EMAIL_COMPLAINED":
      return (
        <svg {...common}>
          <path d="M12 2L1 21h22L12 2z" />
          <path d="M12 9v5" />
          <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function relativeDate(d: Date | null): string {
  if (!d) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`;
  return `Hace ${Math.floor(days / 365)} años`;
}

function fullDate(d: Date): string {
  return d.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export default async function PersonaPage({ params }: { params: { id: string } }) {
  const profile = await getPersonProfile(params.id);
  if (!profile) notFound();

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email;
  const initials =
    (profile.firstName?.charAt(0) || profile.email.charAt(0)).toUpperCase() + (profile.lastName?.charAt(0) ?? "").toUpperCase();
  const badge = STAGE_BADGE[profile.stage];

  return (
    <div>
      <div style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 12 }}>
        <Link href="/admin/crm/personas">CRM / Personas</Link> / {name}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: "#e3faf7",
            color: "var(--accent-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 20,
            flex: "0 0 auto",
          }}
        >
          {initials}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 24, margin: 0 }}>{name}</h1>
            <span
              style={{
                display: "inline-flex",
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: badge.bg,
                color: badge.ink,
              }}
            >
              {LIFECYCLE_LABEL[profile.stage]}
            </span>
          </div>
          <div style={{ fontSize: 14, color: "#5b5f6b", marginTop: 2 }}>
            {profile.email}
            {profile.phone ? ` · ${profile.phone}` : ""}
            {profile.city ? ` · ${profile.city}` : ""}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginBottom: 28 }}>
        <StatCard label="Eventos asistidos" value={String(profile.eventsAttended)} />
        <StatCard label="Registros totales" value={String(profile.registrationsTotal)} />
        <StatCard label="Última actividad" value={relativeDate(profile.lastActivityAt)} />
        <StatCard label="Cliente desde" value={profile.createdAt.toLocaleDateString("es-CO", { month: "short", year: "numeric" })} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2.1fr 1fr", gap: 24, alignItems: "start" }}>
        <div>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Historial</h2>
          {profile.timeline.length === 0 ? (
            <p style={{ color: "#5b5f6b" }}>Sin actividad registrada todavía.</p>
          ) : (
            <div style={{ position: "relative", paddingLeft: 44 }}>
              <div style={{ position: "absolute", left: 16, top: 6, bottom: 6, width: 2, background: "#f0efec" }} />
              {profile.timeline.map((item, i) => {
                const icon = TYPE_ICON[item.type];
                return (
                  <div key={i} style={{ position: "relative", marginBottom: 20 }}>
                    <div
                      style={{
                        position: "absolute",
                        left: -44,
                        top: 0,
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        background: icon.bg,
                        color: icon.ink,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <TimelineIcon type={item.type} />
                    </div>
                    <div style={{ fontSize: 12, color: "#5b5f6b" }}>{fullDate(item.at)}</div>
                    <div style={{ fontSize: 14, marginTop: 2 }}>
                      {item.title}
                      {item.detail && <span style={{ color: "#5b5f6b" }}> — {item.detail}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Consentimientos</div>
            {profile.consents.length === 0 ? (
              <p style={{ fontSize: 13, color: "#5b5f6b", margin: 0 }}>Sin consentimientos registrados.</p>
            ) : (
              dedupeConsentsByPurpose(profile.consents).map((c) => (
                <div
                  key={c.purpose}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    padding: "6px 0",
                    borderBottom: "1px solid #f0efec",
                  }}
                >
                  <span style={{ color: "#5b5f6b" }}>{consentPurposeLabel(c.purpose)}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: c.granted ? "#e8f6ef" : "#fbe9ea",
                      color: c.granted ? "#0e6b4c" : "#a3212b",
                    }}
                  >
                    {c.granted ? "Otorgado" : "Revocado"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// Consent is append-only (a fresh row every time someone re-registers, see
// lib/consent.ts) — the sidebar only needs the latest verdict per purpose,
// not every historical row (that detail already lives in the timeline).
function dedupeConsentsByPurpose(
  consents: { purpose: string; granted: boolean; at: Date }[]
): { purpose: string; granted: boolean; at: Date }[] {
  const latest = new Map<string, { purpose: string; granted: boolean; at: Date }>();
  for (const c of consents) {
    const existing = latest.get(c.purpose);
    if (!existing || c.at > existing.at) latest.set(c.purpose, c);
  }
  return Array.from(latest.values());
}

function consentPurposeLabel(purpose: string): string {
  switch (purpose) {
    case "LOGISTICS":
      return "Logística";
    case "MARKETING":
      return "Marketing";
    case "ADVERTISING":
      return "Publicidad";
    case "WHATSAPP":
      return "WhatsApp";
    default:
      return purpose;
  }
}
