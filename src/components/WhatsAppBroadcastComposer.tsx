"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zonedTimeToUtc, formatDateInTz } from "@/lib/dateFormat";

interface EligibilityPreview {
  total: number;
  eligible: number;
  noConsent: number;
  noPhone: number;
  noTicket: number;
  duplicatePhone: number;
}

interface TicketEventOption {
  id: string;
  name: string;
  when: string;
}

type ScheduleKind = "IMMEDIATE" | "AT_DATETIME";

interface SegmentOption {
  id: string;
  name: string;
  memberCount: number;
}

interface TemplateOption {
  id: string;
  name: string;
  language: string;
  status: string;
  bodyText: string | null;
  variableCount: number;
  /** The template's per-person link button URL (ends in {{1}}), or null —
   * when set, each recipient's button opens their own entrada for the
   * event picked below. */
  ticketButtonUrl: string | null;
}

interface MergeTagOption {
  key: string;
  label: string;
}

interface Props {
  segments: SegmentOption[];
  templates: TemplateOption[];
  /** Events a "Ver mi entrada" button can link to — soonest upcoming first. */
  ticketEvents: TicketEventOption[];
  mergeTags: MergeTagOption[];
  /** From Conexión's live phone-number status — shown as a reference note
   * only (WhatChimp's own "Daily WABA conversation limit"); the app
   * doesn't enforce it client-side, Meta itself rejects sends past it. */
  messagingLimitTier?: string | null;
  /** OrgSettings' configured timezone (America/Bogota by default) — the
   * "Fecha y hora" <input type="datetime-local"> below has to be read
   * against THIS timezone, not whatever the browser's own is. Same
   * reasoning as EventForm.tsx's zonedTimeToUtc: an admin scheduling
   * from outside Colombia (or a server misconfigured to a different TZ)
   * must never have "programar para las 10am" silently mean something
   * else because their laptop's clock is set to a different zone. */
  orgTimezone: string;
}

// Same "pick an existing named segment, never a one-off filter" posture
// as BroadcastComposer.tsx (email) — see that component's own comment.
// The one real difference from email: no free-text body — a WhatsApp
// broadcast MUST use a pre-approved template, so this maps merge tags
// onto the template's {{1}}, {{2}}, ... variables instead of writing copy.
export default function WhatsAppBroadcastComposer({ segments, templates, ticketEvents, mergeTags, messagingLimitTier, orgTimezone }: Props) {
  const router = useRouter();
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(approvedTemplates[0]?.id ?? "");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [assignLabelName, setAssignLabelName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityPreview | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>("IMMEDIATE");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  // Segmento y plantilla vienen preseleccionados apenas se abre esta
  // página (el primero de cada lista — ver sus propios useState arriba),
  // así que un solo clic mal dado, sin revisar nada, podía mandar un
  // mensaje real — con costo real — a decenas de miles de personas. Esto
  // separa "enviar" en dos pasos: el submit del form ya no manda nada —
  // solo abre este resumen y BLOQUEA el resto del formulario mientras
  // tanto (ver los `disabled={confirming}` más abajo), para que lo que
  // se confirma sea exactamente lo que se termina enviando — y el envío
  // de verdad solo ocurre al marcar la casilla y dar clic en el botón de
  // confirmación aparte.
  const [confirming, setConfirming] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [ticketEventId, setTicketEventId] = useState(ticketEvents[0]?.id ?? "");

  const selectedSegment = segments.find((s) => s.id === segmentId);
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const hasTicketButton = Boolean(selectedTemplate?.ticketButtonUrl);
  const selectedTicketEvent = ticketEvents.find((e) => e.id === ticketEventId);
  // Only sent/used when the chosen template actually has the button.
  const effectiveTicketEventId = hasTicketButton ? ticketEventId : "";
  const variableSlots = useMemo(
    () => (selectedTemplate ? Array.from({ length: selectedTemplate.variableCount }, (_, i) => String(i + 1)) : []),
    [selectedTemplate]
  );

  const preview = useMemo(() => {
    if (!selectedTemplate?.bodyText) return null;
    let text = selectedTemplate.bodyText;
    for (const slot of variableSlots) {
      const tag = mergeTags.find((m) => m.key === mapping[slot]);
      text = text.split(`{{${slot}}}`).join(tag ? `[${tag.label}]` : `{{${slot}}}`);
    }
    return text;
  }, [selectedTemplate, variableSlots, mapping, mergeTags]);

  // The real eligibility breakdown, fetched BEFORE any send happens — see
  // previewSegmentRecipients' own comment. Shown above the button instead
  // of only reporting "X sin consentimiento" after the fact, which used
  // to be the only place this ever showed up.
  useEffect(() => {
    if (!segmentId) {
      setEligibility(null);
      return;
    }
    let cancelled = false;
    setEligibilityLoading(true);
    const params = new URLSearchParams({ segmentId });
    if (effectiveTicketEventId) params.set("ticketEventId", effectiveTicketEventId);
    fetch(`/api/admin/whatsapp/broadcasts/preview?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setEligibility(data);
      })
      .catch(() => {
        if (!cancelled) setEligibility(null);
      })
      .finally(() => {
        if (!cancelled) setEligibilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [segmentId, effectiveTicketEventId]);

  // The form's own submit — no longer sends anything. Just validates the
  // schedule field and opens the confirmation step below.
  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    if (scheduleKind === "AT_DATETIME" && !scheduledAtLocal) {
      setResult("Elige una fecha y hora para programar el envío.");
      return;
    }
    if (hasTicketButton && !ticketEventId) {
      setResult("Esta plantilla tiene un botón con enlace personal — elige de qué evento es la entrada que abre.");
      return;
    }

    setConfirming(true);
  }

  function handleCancelConfirm() {
    setConfirming(false);
    setConfirmChecked(false);
  }

  // The actual send — only ever called from the confirmation step's own
  // button (handleReview above never calls this), and only once
  // confirmChecked is true (the button stays disabled otherwise).
  async function handleConfirmSend() {
    setResult(null);

    // Read the datetime-local value against the ORG's configured
    // timezone, not the browser's own — an admin scheduling from
    // outside Colombia (or any mismatch between their machine's clock
    // and America/Bogota) must never have "programar para las 10am"
    // silently become a different real instant. Same helper EventForm.tsx
    // already uses for the same reason.
    const scheduledAtUtc = scheduleKind === "AT_DATETIME" ? zonedTimeToUtc(scheduledAtLocal, orgTimezone) : null;

    setSending(true);
    const res = await fetch("/api/admin/whatsapp/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segmentId,
        templateId,
        variableMapping: mapping,
        assignLabelName: assignLabelName || undefined,
        scheduleKind,
        scheduledAt: scheduledAtUtc ? scheduledAtUtc.toISOString() : undefined,
        ticketEventId: effectiveTicketEventId || undefined,
      }),
    });
    const body = await res.json();
    setSending(false);
    if (res.ok) {
      if (body.sentNow) {
        // A segment bigger than one chunk keeps sending in the background
        // after this response — body.remaining says so honestly instead
        // of implying it's all done. Never left stuck: without
        // body.backgrounded (QStash not configured), the send just kept
        // going synchronously and body.sent already reflects everyone.
        const sentLine = body.failed > 0 ? `Enviado — ${body.sent} entregados, ${body.failed} fallidos.` : `Enviado a los ${body.sent} contactos elegibles.`;
        const noTicketLine =
          body.skippedNoTicket > 0 ? ` ${body.skippedNoTicket} no lo recibieron por no tener entrada confirmada para ese evento.` : "";
        const duplicateLine =
          body.skippedDuplicatePhone > 0
            ? ` ${body.skippedDuplicatePhone} ${body.skippedDuplicatePhone === 1 ? "contacto repetía" : "contactos repetían"} un número que ya lo recibió — no les llegó dos veces.`
            : "";
        const base = `${sentLine}${noTicketLine}${duplicateLine}`;
        setResult(body.remaining > 0 ? `${base} Quedan ${body.remaining} más en camino — siguen enviándose solos.` : base);
      } else if (body.scheduleWarning) {
        setResult(body.scheduleWarning);
      } else {
        const when = scheduledAtUtc ? formatDateInTz(scheduledAtUtc, { dateStyle: "short", timeStyle: "short" }, orgTimezone, "es") : "";
        setResult(`Programada para ${when} — se enviará sola, exactamente a esa hora, no hace falta dejar esta pantalla abierta.`);
      }
      setAssignLabelName("");
      setScheduleKind("IMMEDIATE");
      setScheduledAtLocal("");
      setConfirming(false);
      setConfirmChecked(false);
      router.refresh();
    } else {
      setResult(`Error al enviar: ${body?.error ?? "revisa la consola"}`);
      // Se queda en el paso de confirmación — un error del servidor no
      // significa que haya que volver a revisar todo desde cero.
    }
  }

  if (segments.length === 0) {
    return (
      <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 24, maxWidth: 900 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Nueva difusión</h2>
        <p style={{ color: "#5b5f6b", marginBottom: 0 }}>
          Todavía no tienes ningún segmento guardado — primero <Link href="/admin/crm/segments">créalo en Segmentos</Link>.
        </p>
      </div>
    );
  }

  if (approvedTemplates.length === 0) {
    return (
      <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 24, maxWidth: 900 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Nueva difusión</h2>
        <p style={{ color: "#5b5f6b", marginBottom: 0 }}>
          Todavía no hay ninguna plantilla <strong>aprobada</strong> — créala en el WhatsApp Manager de Meta y luego
          sincronízala en <Link href="/admin/crm/whatsapp/plantillas">Plantillas</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleReview} style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 16 }}>Nueva difusión</h2>

      <div className="field">
        <label htmlFor="segmentId">Segmento</label>
        <select id="segmentId" value={segmentId} onChange={(e) => setSegmentId(e.target.value)} disabled={confirming} required>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.memberCount} {s.memberCount === 1 ? "persona" : "personas"}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
          Solo recibe quien dio consentimiento de WhatsApp y tiene celular registrado.
        </p>
      </div>

      <div className="field">
        <label htmlFor="templateId">Plantilla (aprobada en Meta)</label>
        <select id="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={confirming} required>
          {approvedTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.language})
            </option>
          ))}
        </select>
      </div>

      {hasTicketButton && (
        <div className="field">
          <label htmlFor="ticketEventId">Botón de la plantilla: abre la entrada del evento…</label>
          {ticketEvents.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>
              No hay eventos publicados — esta plantilla necesita uno para saber qué entrada abrir.
            </p>
          ) : (
            <select id="ticketEventId" value={ticketEventId} onChange={(e) => setTicketEventId(e.target.value)} disabled={confirming} required>
              {ticketEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} — {ev.when}
                </option>
              ))}
            </select>
          )}
          <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
            Cada persona recibe el botón con el enlace a <strong>su propia</strong> entrada de ese evento (todas sus boletas,
            una página por boleta). Quien no tenga entrada confirmada para ese evento no recibe esta difusión.
          </p>
        </div>
      )}

      {variableSlots.length > 0 && (
        <div style={{ border: "1px solid #e3e1dc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>Variables de la plantilla</p>
          {variableSlots.map((slot) => (
            <div className="field" key={slot}>
              <label htmlFor={`var_${slot}`}>{`{{${slot}}}`}</label>
              <select
                id={`var_${slot}`}
                value={mapping[slot] ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [slot]: e.target.value }))}
                disabled={confirming}
                required
              >
                <option value="" disabled>
                  Selecciona un campo
                </option>
                {mergeTags.map((tag) => (
                  <option key={tag.key} value={tag.key}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div style={{ background: "#f6f5f2", borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 14, whiteSpace: "pre-wrap" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#5b5f6b", margin: "0 0 6px" }}>Vista previa</p>
          {preview}
        </div>
      )}

      <div className="field">
        <label htmlFor="assignLabelName">Etiquetar a quien reciba esta difusión (opcional)</label>
        <input
          id="assignLabelName"
          value={assignLabelName}
          onChange={(e) => setAssignLabelName(e.target.value)}
          placeholder="ej. contactado-cali-2026"
          disabled={confirming}
        />
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
          Útil para excluirlos de una próxima tanda desde Segmentos — se crea sola si no existe.
        </p>
      </div>

      <div className="field">
        <label htmlFor="scheduleKind">Enviar</label>
        <select id="scheduleKind" value={scheduleKind} onChange={(e) => setScheduleKind(e.target.value as ScheduleKind)} disabled={confirming}>
          <option value="IMMEDIATE">Inmediatamente</option>
          <option value="AT_DATETIME">A una fecha y hora programada</option>
        </select>
      </div>

      {scheduleKind === "AT_DATETIME" && (
        <div className="field">
          <label htmlFor="scheduledAtLocal">Fecha y hora</label>
          <input
            id="scheduledAtLocal"
            type="datetime-local"
            value={scheduledAtLocal}
            onChange={(e) => setScheduledAtLocal(e.target.value)}
            disabled={confirming}
            required
          />
          <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
            Sale exactamente a esa hora. Si algo falla al programarlo verás un aviso acá abajo — igual queda
            asegurado un envío de respaldo dentro de las siguientes 24h.
          </p>
        </div>
      )}

      <div style={{ background: "#f0efec", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#5b5f6b" }}>
        {eligibilityLoading && !eligibility && "Calculando a quién le llegará..."}
        {eligibility && (
          <>
            Le llegará a <strong>{eligibility.eligible}</strong> de {eligibility.total}{" "}
            {eligibility.total === 1 ? "persona" : "personas"} del segmento
            {(eligibility.noConsent > 0 || eligibility.noPhone > 0 || eligibility.noTicket > 0) && (
              <>
                {" "}
                (
                {[
                  eligibility.noConsent > 0 && `${eligibility.noConsent} sin consentimiento de WhatsApp`,
                  eligibility.noPhone > 0 && `${eligibility.noPhone} sin celular`,
                  eligibility.noTicket > 0 && `${eligibility.noTicket} sin entrada confirmada para ese evento`,
                ]
                  .filter(Boolean)
                  .map((text, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      <span style={{ color: "#b8791a", fontWeight: 600 }}>{text}</span>
                    </span>
                  ))}
                {" — no recibirán nada)"}
              </>
            )}
            {eligibility.duplicatePhone > 0 && (
              <>
                {". "}
                {eligibility.duplicatePhone} {eligibility.duplicatePhone === 1 ? "contacto repite" : "contactos repiten"} el celular de
                otro — a cada número le llega un solo mensaje
              </>
            )}
            .
          </>
        )}
        {!eligibilityLoading && !eligibility && (
          <>
            Se enviará a hasta <strong>{selectedSegment?.memberCount ?? 0}</strong> personas del segmento.
          </>
        )}
        {messagingLimitTier && (
          <>
            {" "}
            Límite diario de mensajería de esta cuenta: <strong>{messagingLimitTier}</strong>.
          </>
        )}
      </div>

      {!confirming ? (
        <button className="primary" type="submit" style={{ width: "auto", padding: "10px 24px" }}>
          {scheduleKind === "IMMEDIATE" ? "Revisar y enviar" : "Revisar y programar"}
        </button>
      ) : (
        <div style={{ border: "1px solid var(--danger)", borderRadius: 10, padding: 16, background: "#fdf2f4" }}>
          <p style={{ fontWeight: 700, margin: "0 0 10px", color: "var(--danger)" }}>⚠ Confirma antes de enviar — esto no se puede deshacer</p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7 }}>
            <li>
              Segmento: <strong>{selectedSegment?.name}</strong>
            </li>
            <li>
              Le llegará realmente a <strong>{eligibility?.eligible ?? selectedSegment?.memberCount ?? 0}</strong>{" "}
              {(eligibility?.eligible ?? selectedSegment?.memberCount ?? 0) === 1 ? "persona" : "personas"}
            </li>
            <li>
              Plantilla: <strong>{selectedTemplate?.name}</strong> ({selectedTemplate?.language})
            </li>
            {hasTicketButton && (
              <li>
                Botón: abre la entrada de cada persona para <strong>{selectedTicketEvent?.name}</strong>
              </li>
            )}
            <li>
              Envío:{" "}
              <strong>
                {scheduleKind === "IMMEDIATE"
                  ? "inmediato — sale apenas confirmes"
                  : `programado para ${scheduledAtLocal.replace("T", " ")} (hora ${orgTimezone})`}
              </strong>
            </li>
          </ul>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, marginBottom: 14 }}>
            <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              Confirmo que revisé el segmento y la plantilla de arriba, y quiero {scheduleKind === "IMMEDIATE" ? "enviar esto ahora" : "programar este envío"}{" "}
              a {eligibility?.eligible ?? selectedSegment?.memberCount ?? 0} {(eligibility?.eligible ?? selectedSegment?.memberCount ?? 0) === 1 ? "persona" : "personas"}.
            </span>
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={handleCancelConfirm} disabled={sending} style={{ padding: "10px 20px", background: "#fff", border: "1px solid #e3e1dc", borderRadius: 8, cursor: "pointer" }}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleConfirmSend}
              disabled={!confirmChecked || sending}
              style={{ width: "auto", padding: "10px 24px" }}
            >
              {sending ? "Enviando..." : scheduleKind === "IMMEDIATE" ? "Sí, enviar difusión ahora" : "Sí, programar envío"}
            </button>
          </div>
        </div>
      )}
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </form>
  );
}
