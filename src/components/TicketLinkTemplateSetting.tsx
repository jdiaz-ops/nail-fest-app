"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TemplateOption {
  id: string;
  name: string;
  language: string;
}

/** Turns on/off + picks the template for "enviar el enlace de la entrada
 * por WhatsApp al registrarse" (OrgSettings.ticketLinkWhatsAppTemplateId)
 * — lives at the top of Plantillas since the only valid choices are
 * templates already APPROVED here. Only offers UTILITY ones with a
 * dynamic URL button (url containing "{{") — a MARKETING template would
 * cost more and doesn't fit "sent right after registering, to everyone",
 * and a template with no dynamic button would just open the same static
 * link for every recipient, defeating the point. */
export default function TicketLinkTemplateSetting({
  eligibleTemplates,
  currentTemplateId,
}: {
  eligibleTemplates: TemplateOption[];
  currentTemplateId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentTemplateId ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function save(next: string) {
    setStatus("saving");
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketLinkWhatsAppTemplateId: next }),
    });
    if (res.ok) {
      setValue(next);
      setStatus("idle");
      setMessage(next ? "Activado — se enviará con cada registro nuevo." : "Desactivado.");
      router.refresh();
    } else {
      setStatus("error");
      setMessage("No se pudo guardar.");
    }
  }

  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 16, marginBottom: 20, maxWidth: 700 }}>
      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>Enlace de la entrada al registrarse (WhatsApp)</p>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#5b5f6b" }}>
        Envía automáticamente, justo después de cada registro, una plantilla de Utilidad con un botón que abre la
        entrada de esa persona — igual al mensaje que aerolíneas como LATAM mandan con la tarjeta de embarque. Solo
        aparecen acá las plantillas APROBADAS con un botón de enlace dinámico (creado marcando &quot;El enlace es
        distinto para cada persona&quot; al crear la plantilla arriba).
      </p>
      {eligibleTemplates.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8a8478" }}>
          Todavía no hay ninguna plantilla así aprobada — créala arriba y vuelve cuando Meta la apruebe.
        </p>
      ) : (
        <select
          value={value}
          disabled={status === "saving"}
          onChange={(e) => save(e.target.value)}
          style={{ maxWidth: 360 }}
        >
          <option value="">Desactivado</option>
          {eligibleTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.language})
            </option>
          ))}
        </select>
      )}
      {message && <p style={{ marginTop: 8, fontSize: 13, color: status === "error" ? "#c2185b" : "#2e7a57" }}>{message}</p>}
    </div>
  );
}
