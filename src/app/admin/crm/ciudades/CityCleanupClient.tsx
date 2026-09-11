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
//
// "exact"/"prefix" pre-select their suggestion — there's genuinely only
// one plausible answer (a pure accent/casing difference, or the raw
// value is unambiguously a real prefix of exactly one city). "fuzzy" is
// an algorithmic GUESS (string similarity, not a real prefix) — it can
// be wrong ("Barranquila" could be a typo for Barranquilla, or a
// misspelling of some other nearby town), so it now defaults to "keep"
// and needs an actual look, same as "none". This used to pre-select
// fuzzy too, which meant the single "Aplicar cambios" button could
// silently apply a wrong guess right alongside the genuinely safe
// merges — this split is what makes "Aplicar automáticamente lo obvio"
// below an actually narrower, safer action, not just a second button
// doing the same thing.
function defaultAction(row: CityCleanupRow): string {
  if (row.notACity) return "blank";
  if (row.suggested && (row.confidence === "exact" || row.confidence === "prefix")) {
    return `merge:${row.suggested}`;
  }
  return "keep";
}

// The set "Aplicar automáticamente lo obvio" touches — unambiguous cases
// only: a single suggested match with no real judgment call involved
// (exact/prefix), or a value that plainly isn't a city at all (mostly
// digits — a cédula number, say). Computed straight from `rows`, not
// from the current `actions` state, so it always means the same safe
// subset no matter what an admin may have manually changed elsewhere on
// the page — it never touches a fuzzy/ambiguous row, whatever that row's
// own dropdown currently shows.
function isAutoApplicable(row: CityCleanupRow): boolean {
  return row.notACity || (row.suggested !== null && (row.confidence === "exact" || row.confidence === "prefix"));
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

  // The subset "Aplicar automáticamente lo obvio" targets — isAutoApplicable
  // rows that still have a real action queued (not "keep"). Reads from
  // the current `actions` state, same as `pending` — so it naturally
  // respects a manual override (an admin who deliberately picked a
  // different city, or set an exact/prefix row back to "No cambiar",
  // stays respected either way), it just never reaches into a fuzzy/
  // ambiguous row regardless of what that row's own dropdown shows.
  const autoApplicable = useMemo(
    () => rows.filter((r) => isAutoApplicable(r) && actions[r.raw] && actions[r.raw] !== "keep"),
    [rows, actions]
  );
  const autoApplicablePeople = autoApplicable.reduce((sum, r) => sum + r.count, 0);

  function setAction(raw: string, value: string) {
    setActions((a) => ({ ...a, [raw]: value }));
    setResult(null);
  }

  // Shared by both buttons below — only WHICH rows and what the confirm
  // dialog says differ; the actual apply (read each target row's current
  // action, build the mapping, POST, refresh) is identical either way.
  async function applyRows(targetRows: CityCleanupRow[], confirmMessage: string) {
    if (targetRows.length === 0) return;
    if (!confirm(confirmMessage)) return;
    setApplying(true);
    setResult(null);
    const mappings = targetRows.map((r) => {
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

  function handleApply() {
    return applyRows(
      pending,
      `¿Aplicar ${pending.length} cambio(s), afectando a ${pendingPeople} persona(s)? Esto actualiza Person.city de verdad — no se puede deshacer con un clic.`
    );
  }

  function handleAutoApply() {
    return applyRows(
      autoApplicable,
      `¿Aplicar automáticamente los ${autoApplicable.length} caso(s) obvios (coinciden solo en mayúsculas/tildes, o son claramente un prefijo de una sola ciudad — y los que claramente no son una ciudad), afectando a ${autoApplicablePeople} persona(s)? Los casos "Parecido" (adivinados) y sin coincidencia NO se tocan — esos siguen necesitando tu revisión manual. No se puede deshacer con un clic.`
    );
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
          persona(s) — de esos, <strong>{autoApplicable.length}</strong> son casos obvios (
          {autoApplicablePeople} persona(s)).
        </span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleAutoApply}
            disabled={applying || autoApplicable.length === 0}
            style={{ width: "auto", padding: "8px 20px", background: "#fff", border: "1px solid #12966b", color: "#0e6b4c", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
            title="Solo mayúsculas/tildes, un prefijo sin ambigüedad, o claramente no es una ciudad — nunca toca un caso 'Parecido' o sin coincidencia."
          >
            {applying ? "Aplicando…" : `Aplicar automáticamente lo obvio (${autoApplicable.length})`}
          </button>
          <button className="primary" type="button" onClick={handleApply} disabled={applying || pending.length === 0} style={{ width: "auto", padding: "8px 20px" }}>
            {applying ? "Aplicando…" : "Aplicar cambios"}
          </button>
        </div>
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
