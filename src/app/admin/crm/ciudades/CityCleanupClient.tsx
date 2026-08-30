"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COLOMBIA_CITIES } from "@/lib/colombiaCities";

export interface CityCleanupRow {
  raw: string;
  count: number;
  confidence: "exact" | "prefix" | "fuzzy" | "none";
  notACity: boolean;
  candidates: string[];
  suggested: string | null;
}

const CONFIDENCE_LABEL: Record<CityCleanupRow["confidence"], string> = {
  exact: "Coincide (solo mayúsculas/tildes)",
  prefix: "Empieza igual",
  fuzzy: "Parecido",
  none: "Sin coincidencia",
};

// Every row's chosen action — "keep" (default, no change), "merge:<label>"
// (fuse this raw value into that canonical city on save), or "blank"
// (this isn't a city at all — clear it). Encoded as one string so a
// single <select> per row can drive it without extra state shapes.
function defaultAction(row: CityCleanupRow): string {
  if (row.notACity) return "blank";
  if (row.suggested && (row.confidence === "exact" || row.confidence === "prefix" || row.confidence === "fuzzy")) {
    return `merge:${row.suggested}`;
  }
  return "keep";
}

export default function CityCleanupClient({ rows }: { rows: CityCleanupRow[] }) {
  const router = useRouter();
  const [actions, setActions] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.raw, defaultAction(r)]))
  );
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const pending = useMemo(
    () => rows.filter((r) => actions[r.raw] && actions[r.raw] !== "keep"),
    [rows, actions]
  );
  const pendingPeople = pending.reduce((sum, r) => sum + r.count, 0);

  function setAction(raw: string, value: string) {
    setActions((a) => ({ ...a, [raw]: value }));
    setResult(null);
  }

  async function handleApply() {
    if (pending.length === 0) return;
    if (
      !confirm(
        `¿Aplicar ${pending.length} cambio(s), afectando a ${pendingPeople} persona(s)? Esto actualiza Person.city de verdad — no se puede deshacer con un clic.`
      )
    ) {
      return;
    }
    setApplying(true);
    setResult(null);
    const mappings = pending.map((r) => {
      const action = actions[r.raw] ?? "keep";
      const newValue = action === "blank" ? null : action.slice("merge:".length);
      return { raw: r.raw, newValue };
    });
    const res = await fetch("/api/admin/crm/city-cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappings }),
    });
    const body = await res.json().catch(() => ({}));
    setApplying(false);
    if (res.ok) {
      setResult(`Listo — se actualizaron ${body.totalUpdated} persona(s) en ${mappings.length} valor(es) de ciudad.`);
      router.refresh();
    } else {
      setResult(`Error al aplicar: ${body.error ?? "revisa la consola"}.`);
    }
  }

  if (rows.length === 0) {
    return (
      <p style={{ color: "#5b5f6b" }}>
        No hay valores de ciudad pendientes de revisión — todo lo que hay en la base ya coincide con la lista
        oficial de municipios.
      </p>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f0efec",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 14 }}>
          <strong>{pending.length}</strong> cambio(s) marcados, afectando a <strong>{pendingPeople}</strong>{" "}
          persona(s).
        </span>
        <button className="primary" type="button" onClick={handleApply} disabled={applying || pending.length === 0} style={{ width: "auto", padding: "8px 20px" }}>
          {applying ? "Aplicando…" : "Aplicar cambios"}
        </button>
      </div>
      {result && <p style={{ marginBottom: 16, fontSize: 14 }}>{result}</p>}

      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Valor guardado</th>
              <th style={{ padding: "10px 12px" }}>Personas</th>
              <th style={{ padding: "10px 12px" }}>Coincidencia</th>
              <th style={{ padding: "10px 12px" }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const action = actions[r.raw] ?? "keep";
              const changed = action !== "keep";
              return (
                <tr key={r.raw} style={{ borderTop: "1px solid #f0efec", background: changed ? "#f0faf8" : undefined }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>&ldquo;{r.raw}&rdquo;</td>
                  <td style={{ padding: "10px 12px" }}>{r.count}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                    {r.notACity ? "No parece una ciudad" : CONFIDENCE_LABEL[r.confidence]}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <select value={action} onChange={(e) => setAction(r.raw, e.target.value)} style={{ minWidth: 260 }}>
                      <option value="keep">No cambiar</option>
                      {r.candidates.map((c) => (
                        <option key={c} value={`merge:${c}`}>
                          Fusionar a: {c}
                        </option>
                      ))}
                      <option value="blank">Vaciar (quitar la ciudad)</option>
                      <optgroup label="Elegir otra ciudad de la lista completa">
                        {COLOMBIA_CITIES.map((c) => (
                          <option key={c.label} value={`merge:${c.label}`}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 12 }}>
        Nota: si algún segmento guardado filtra por uno de estos valores exactos, fusionarlo aquí puede hacer que
        ese segmento deje de encontrar a esas personas — revisa{" "}
        <a href="/admin/crm/segments">Segmentos</a> después de aplicar cambios grandes.
      </p>
    </div>
  );
}
