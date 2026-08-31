"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseDoorlistCsv,
  groupIntoImportPeople,
  type ImportPerson,
} from "@/lib/import/ticketTailorDoorlist";

interface Props {
  events: { slug: string; name: string }[];
}

type EventMode = "existing" | "new";

interface Preview {
  people: ImportPerson[];
  skippedNoEmail: number;
  unmappedProfessions: string[];
  cityCounts: [string, number][];
}

export default function ImportComposer({ events }: Props) {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  const [eventMode, setEventMode] = useState<EventMode>(events.length > 0 ? "existing" : "new");
  const [existingSlug, setExistingSlug] = useState(events[0]?.slug ?? "");
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [newCapacity, setNewCapacity] = useState("");

  const [marketingConsent, setMarketingConsent] = useState(true);
  const [advertisingConsent, setAdvertisingConsent] = useState(true);
  // Checked by default per an explicit call made on /admin/crm/import's
  // own page — NOT a formality: the original Ticket Tailor registration
  // these historical rows came from never asked about WhatsApp
  // specifically, so this is a real decision to treat that consent as
  // covering it, with the risk (Meta quality-rating/spam-report exposure
  // from messaging people who never opted into this exact channel, and
  // the Ley 1581 "informed consent for the specific channel" question)
  // spelled out to whoever's importing, every time, right above the
  // checkbox — see the fieldset copy below.
  const [whatsappConsent, setWhatsappConsent] = useState(true);

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseDoorlistCsv(text);
      const grouped = groupIntoImportPeople(rows);
      const cityCounts = new Map<string, number>();
      for (const p of grouped.people) {
        const key = p.city ?? "(sin ciudad)";
        cityCounts.set(key, (cityCounts.get(key) ?? 0) + 1);
      }
      setPreview({
        people: grouped.people,
        skippedNoEmail: grouped.skippedNoEmail,
        unmappedProfessions: grouped.unmappedProfessions,
        cityCounts: [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
      });
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    setResult(null);

    const eventPayload =
      eventMode === "existing"
        ? { mode: "existing" as const, slug: existingSlug }
        : {
            mode: "new" as const,
            slug: newSlug,
            name: newName,
            city: newCity,
            startsAt: newStartsAt ? new Date(newStartsAt).toISOString() : "",
            endsAt: newEndsAt ? new Date(newEndsAt).toISOString() : null,
            capacity: newCapacity ? Number(newCapacity) : null,
          };

    const res = await fetch("/api/admin/import-registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: eventPayload,
        consent: { marketing: marketingConsent, advertising: advertisingConsent, whatsapp: whatsappConsent },
        people: preview.people,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setImporting(false);
    if (res.ok) {
      setResult(
        `Listo — "${body.event.name}": ${body.created} registros nuevos, ${body.updated} ya existían y se actualizaron (sin duplicar). ${body.peopleWithAnyCheckIn} personas con asistencia real. Aforo real: ${body.ticketsCheckedIn} de ${body.ticketsIssued} boletas escaneadas en la puerta. ${body.professionsCreated.length > 0 ? `Profesiones nuevas creadas: ${body.professionsCreated.join(", ")}.` : ""}`
      );
      router.refresh();
    } else {
      setResult(`Error: ${body.error ?? "algo salió mal"} — revisa la consola.`);
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="field">
        <label>Archivo CSV (export &quot;doorlist&quot; de Ticket Tailor)</label>
        <input type="file" accept=".csv" onChange={handleFile} />
        {fileName && <p style={{ fontSize: 13, color: "#5b5f6b" }}>{fileName}</p>}
      </div>

      {preview && (
        <div style={{ background: "#f0efec", borderRadius: 8, padding: 12, marginTop: 12, fontSize: 13 }}>
          <p>
            <strong>{preview.people.length}</strong> personas únicas detectadas
            {preview.skippedNoEmail > 0 && <> — {preview.skippedNoEmail} filas sin email fueron omitidas</>}.{" "}
            <strong>{preview.people.filter((p) => p.checkedInCount > 0).length}</strong> con asistencia real
            (check-in) —{" "}
            <strong>{preview.people.reduce((sum, p) => sum + p.checkedInCount, 0)}</strong> boletas escaneadas de{" "}
            <strong>{preview.people.reduce((sum, p) => sum + p.ticketCount, 0)}</strong> emitidas (aforo real).
          </p>
          {preview.unmappedProfessions.length > 0 && (
            <p style={{ color: "#c2185b" }}>
              Profesiones no reconocidas (se importan tal cual, como categoría nueva):{" "}
              {preview.unmappedProfessions.join(" · ")}
            </p>
          )}
          <p style={{ marginTop: 8 }}>
            <strong>Ciudades:</strong>{" "}
            {preview.cityCounts.map(([c, n]) => `${c} (${n})`).join(", ")}
          </p>
        </div>
      )}

      <fieldset style={{ marginTop: 16, marginBottom: 16, border: "1px solid #e3e1dc", borderRadius: 8, padding: 12 }}>
        <legend>Evento</legend>
        <div className="field">
          <label>
            <input
              type="radio"
              checked={eventMode === "existing"}
              onChange={() => setEventMode("existing")}
              disabled={events.length === 0}
            />{" "}
            Evento existente
          </label>
          {eventMode === "existing" && (
            <select value={existingSlug} onChange={(e) => setExistingSlug(e.target.value)}>
              {events.map((ev) => (
                <option key={ev.slug} value={ev.slug}>
                  {ev.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="field" style={{ marginTop: 8 }}>
          <label>
            <input type="radio" checked={eventMode === "new"} onChange={() => setEventMode("new")} /> Crear evento
            nuevo
          </label>
        </div>
        {eventMode === "new" && (
          <>
            <div className="field">
              <label>Slug (URL, ej. pereira-2026)</label>
              <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="pereira-2026" />
            </div>
            <div className="field">
              <label>Nombre</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nail Fest Pereira 2026" />
            </div>
            <div className="field">
              <label>Ciudad</label>
              <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Pereira" />
            </div>
            <div className="field">
              <label>Inicio</label>
              <input type="datetime-local" value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Fin (opcional)</label>
              <input type="datetime-local" value={newEndsAt} onChange={(e) => setNewEndsAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Capacidad (opcional)</label>
              <input type="number" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} />
            </div>
          </>
        )}
      </fieldset>

      <fieldset style={{ marginBottom: 16, border: "1px solid #e3e1dc", borderRadius: 8, padding: 12 }}>
        <legend>Consentimiento a importar</legend>
        <p style={{ fontSize: 13, color: "#5b5f6b" }}>
          LOGISTICS siempre se marca como otorgado (implícito al haberse registrado).
        </p>
        <label style={{ display: "block" }}>
          <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />{" "}
          Marketing (recibir broadcasts de correo)
        </label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={advertisingConsent}
            onChange={(e) => setAdvertisingConsent(e.target.checked)}
          />{" "}
          Publicidad (entrar a audiencias de Meta)
        </label>
        <label style={{ display: "block", marginTop: 4 }}>
          <input type="checkbox" checked={whatsappConsent} onChange={(e) => setWhatsappConsent(e.target.checked)} />{" "}
          WhatsApp (recibir difusiones)
        </label>
        <p style={{ fontSize: 12, color: "#b8791a", margin: "6px 0 0" }}>
          El registro original de Ticket Tailor nunca les preguntó específicamente por WhatsApp — al marcar esto
          asumís que ese consentimiento general también cubre este canal. Riesgo real: si alguien reporta el mensaje
          como spam, Meta puede bajar la calidad de tu número o suspenderlo.
        </p>
      </fieldset>

      <button className="primary" onClick={handleImport} disabled={!preview || importing}>
        {importing ? "Importando..." : preview ? `Importar ${preview.people.length} personas` : "Sube un archivo primero"}
      </button>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </div>
  );
}
