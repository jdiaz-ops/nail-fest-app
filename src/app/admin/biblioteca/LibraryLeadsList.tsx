"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLead } from "@/lib/library/admin";
import { LEAD_KIND_LABELS, LIBRARY_LEAD_KINDS, PUBLIC_LEAD_KINDS, type LibraryLeadKindKey } from "@/lib/library/leads";
import { api, CardTitle, cardStyle, mutedText, Pill, secondaryButtonStyle } from "../cuponera/ui";
import { FormError, rowStyle } from "./ui";

/** wa.me wants the number with its country code and nothing else (Colombia by default). */
function whatsappLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits}`;
}

// Editar biblioteca → Registros: what people sent from the library and the
// instructors' pages, newest first. Nothing was sent to them automatically:
// whoever answers marks it as handled here.
export default function LibraryLeadsList({ leads, pending }: { leads: AdminLead[]; pending: Record<string, number> }) {
  const router = useRouter();
  const [kind, setKind] = useState<LibraryLeadKindKey | "todos">("todos");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The box changes right away; the counts follow when the page reloads.
  const [handledNow, setHandledNow] = useState<Record<string, boolean>>({});
  const shown = (kind === "todos" ? leads : leads.filter((l) => l.kind === kind)).map((l) => ({ ...l, handled: handledNow[l.id] ?? l.handled }));
  // The forms still on the pages, plus any old kind that has something in it.
  const kinds = LIBRARY_LEAD_KINDS.filter((k) => PUBLIC_LEAD_KINDS.includes(k) || leads.some((l) => l.kind === k));

  async function setHandled(lead: AdminLead, handled: boolean) {
    setBusyId(lead.id);
    setError(null);
    setHandledNow((h) => ({ ...h, [lead.id]: handled }));
    try {
      await api(`/api/admin/library/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ handled }) });
      router.refresh();
    } catch {
      setHandledNow((h) => ({ ...h, [lead.id]: !handled }));
      setError("No se pudo guardar. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  const tab = (key: LibraryLeadKindKey | "todos", label: string) => {
    const count = key === "todos" ? Object.values(pending).reduce((a, b) => a + b, 0) : (pending[key] ?? 0);
    return (
      <button
        key={key}
        type="button"
        onClick={() => setKind(key)}
        style={{ ...secondaryButtonStyle, ...(kind === key ? { background: "#17181c", color: "#fff", borderColor: "#17181c" } : {}) }}
      >
        {label}
        {count > 0 ? ` (${count})` : ""}
      </button>
    );
  };

  return (
    <div style={cardStyle}>
      <CardTitle
        aside={
          <a href={`/api/admin/library/leads/export${kind === "todos" ? "" : `?tipo=${kind}`}`} style={{ fontSize: 13, fontWeight: 600 }}>
            Descargar CSV
          </a>
        }
      >
        Registros y solicitudes
      </CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        El registro gratis de la biblioteca y las postulaciones de instructoras. A nadie se le envió nada automático: escríbele tú y márcalo como
        atendido. Entre paréntesis, los que faltan por atender.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {tab("todos", "Todos")}
        {kinds.map((k) => tab(k, LEAD_KIND_LABELS[k]))}
      </div>
      {error && <FormError>{error}</FormError>}
      {shown.length === 0 ? (
        <p style={{ ...mutedText, padding: "12px 0", borderTop: "1px solid #efece7", margin: 0 }}>Todavía no llega nada por aquí.</p>
      ) : (
        shown.map((l) => {
          const wa = l.phone ? whatsappLink(l.phone) : null;
          return (
            <div key={l.id} style={{ ...rowStyle, alignItems: "flex-start", opacity: l.handled ? 0.55 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</span>
                  <Pill tone={l.kind === "REGISTRO" ? "grey" : l.kind === "MARCA" ? "amber" : "green"}>{LEAD_KIND_LABELS[l.kind as LibraryLeadKindKey] ?? l.kind}</Pill>
                  {l.marketingConsent && <Pill tone="pink">Acepta novedades</Pill>}
                  <span style={{ ...mutedText, fontSize: 12 }}>{l.createdAtLabel}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  <a href={`mailto:${l.email}`}>{l.email}</a>
                  {l.phone && (
                    <>
                      {" · "}
                      {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer">
                          {l.phone}
                        </a>
                      ) : (
                        l.phone
                      )}
                    </>
                  )}
                  {l.city && ` · ${l.city}`}
                </div>
                {(l.company || l.instructorName || l.context) && (
                  <div style={{ ...mutedText, fontSize: 12, marginTop: 2 }}>
                    {[l.company && `Marca: ${l.company}`, l.instructorName && `Instructora: ${l.instructorName}`, l.context].filter(Boolean).join(" · ")}
                  </div>
                )}
                {l.message && <p style={{ fontSize: 13, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{l.message}</p>}
              </div>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, whiteSpace: "nowrap", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={l.handled}
                  disabled={busyId === l.id}
                  aria-label={`Atendido: ${l.name}`}
                  onChange={(e) => setHandled(l, e.target.checked)}
                />
                Atendido
              </label>
            </div>
          );
        })
      )}
    </div>
  );
}
