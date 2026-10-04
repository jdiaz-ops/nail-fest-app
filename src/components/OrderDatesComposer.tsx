"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseOrdersCsv, type OrdersParseResult } from "@/lib/import/ordersCsv";

// "Fechas de inscripción" — second step of a historical import: the doorlist
// (ImportComposer, above it on the page) brings the people; Ticket Tailor's
// ORDERS export brings the day each one signed up. See
// lib/import/ordersCsv.ts and /api/admin/import-order-dates.

interface Props {
  // startsOn = the event's start date (YYYY-MM-DD, org timezone) — to warn
  // when the file's own "Event start" is a different day (wrong event picked).
  events: { slug: string; name: string; startsOn: string }[];
}

const fmtLocal = (local: string | null) => {
  if (!local) return "—";
  const [d, t] = local.split("T");
  const [y, m, day] = d!.split("-");
  return `${Number(day)}/${m}/${y} ${t}`;
};

export default function OrderDatesComposer({ events }: Props) {
  const router = useRouter();
  const [slug, setSlug] = useState(events[0]?.slug ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrdersParseResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const event = events.find((e) => e.slug === slug);
  const fileStartsOn = preview?.eventStartLocal?.slice(0, 10) ?? null;
  const wrongEvent = Boolean(event && fileStartsOn && fileStartsOn !== event.startsOn);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(parseOrdersCsv(String(reader.result ?? "")));
    reader.readAsText(file);
  }

  async function handleApply() {
    if (!preview || !event) return;
    setApplying(true);
    setResult(null);
    setError(null);
    const res = await fetch("/api/admin/import-order-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventSlug: event.slug, entries: preview.entries }),
    });
    const body = await res.json().catch(() => ({}));
    setApplying(false);
    if (!res.ok) {
      setError("No se pudieron aplicar las fechas — revisa que el archivo sea el export de órdenes y vuelve a intentar.");
      return;
    }
    const parts = [
      `Listo — "${body.event.name}": ${body.updated.toLocaleString("es-CO")} inscripciones ahora tienen su fecha real.`,
      body.matchedByCedula > 0 ? `${body.matchedByCedula} se encontraron por cédula (el correo no coincidía).` : "",
      body.notFound > 0 ? `${body.notFound} personas del archivo no están inscritas a este evento en la app (siguen sin fecha).` : "",
      body.notImported > 0 ? `${body.notImported} se inscribieron directamente en la app — ya tenían su fecha real y no se tocaron.` : "",
    ];
    setResult(parts.filter(Boolean).join(" "));
    router.refresh();
  }

  return (
    <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #e3e1dc" }}>
      <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Fechas de inscripción</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 12px", maxWidth: 720 }}>
        La lista de puerta no trae la fecha en que cada persona se inscribió. En Ticket Tailor, entra al evento → <strong>Orders</strong>{" "}
        → exporta el CSV, y súbelo aquí al evento correspondiente. Cada persona se encuentra por correo (o por cédula si el
        correo no coincide) y solo se le pone la fecha de inscripción — no se cambia ningún otro dato, y las inscripciones
        hechas directamente en la app no se tocan.
      </p>

      <div className="field" style={{ maxWidth: 420 }}>
        <label>Evento</label>
        <select value={slug} onChange={(e) => setSlug(e.target.value)}>
          {events.map((ev) => (
            <option key={ev.slug} value={ev.slug}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Export de órdenes (CSV)</label>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        {fileName && <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>{fileName}</p>}
      </div>

      {preview && preview.missingDateColumn && (
        <p style={{ color: "#c2185b", fontSize: 13 }}>
          Este archivo no tiene la columna «Order date» — parece la lista de puerta (doorlist). Exporta desde{" "}
          <strong>Orders</strong> en Ticket Tailor.
        </p>
      )}

      {preview && !preview.missingDateColumn && (
        <div style={{ background: "#f0efec", borderRadius: 8, padding: 12, margin: "12px 0", fontSize: 13 }}>
          <p style={{ margin: 0 }}>
            <strong>{preview.entries.length.toLocaleString("es-CO")}</strong> personas ({preview.orders.toLocaleString("es-CO")} órdenes,{" "}
            {preview.tickets.toLocaleString("es-CO")} entradas) · primera orden {fmtLocal(preview.firstOrderLocal)} · última{" "}
            {fmtLocal(preview.lastOrderLocal)}
          </p>
          {preview.eventNames.length > 0 && <p style={{ margin: "6px 0 0" }}>Evento en el archivo: {preview.eventNames.join(", ")}</p>}
          {(preview.skippedCancelled > 0 || preview.skippedNoEmail > 0 || preview.skippedBadDate > 0) && (
            <p style={{ margin: "6px 0 0", color: "#5b5f6b" }}>
              Omitidas: {preview.skippedCancelled} canceladas · {preview.skippedNoEmail} sin correo · {preview.skippedBadDate} con fecha ilegible
            </p>
          )}
          {wrongEvent && (
            <p style={{ margin: "8px 0 0", color: "#b25e00", fontWeight: 600 }}>
              Ojo: el archivo es de un evento que empieza el {fmtLocal(`${fileStartsOn}T`).replace(/ $/, "")}, pero el evento elegido empieza el{" "}
              {fmtLocal(`${event!.startsOn}T`).replace(/ $/, "")}. Revisa que hayas elegido el evento correcto.
            </p>
          )}
        </div>
      )}

      <button
        className="primary"
        onClick={handleApply}
        disabled={!preview || preview.missingDateColumn || preview.entries.length === 0 || applying || !event}
      >
        {applying ? "Aplicando…" : preview && !preview.missingDateColumn ? `Aplicar fechas a ${preview.entries.length.toLocaleString("es-CO")} personas` : "Sube un archivo primero"}
      </button>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
      {error && <p style={{ marginTop: 12, color: "#c2185b" }}>{error}</p>}
    </div>
  );
}
