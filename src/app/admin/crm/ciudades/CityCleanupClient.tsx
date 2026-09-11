"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COLOMBIA_CITIES } from "@/lib/colombiaCities";
import { normalizeCityString } from "@/lib/cityMatch";
import StatCard from "../StatCard";

export interface CityCleanupRow {
  raw: string;
  count: number;
  confidence: "exact" | "prefix" | "fuzzy" | "none";
  notACity: boolean;
  candidates: string[];
  suggested: string | null;
}

interface RawCity {
  raw: string;
  count: number;
}

const CONFIDENCE_LABEL: Record<CityCleanupRow["confidence"], string> = {
  exact: "Coincide (solo mayúsculas/tildes)",
  prefix: "Empieza igual",
  fuzzy: "Parecido",
  none: "Sin coincidencia",
};

// How many raw values one /match request computes at once — see that
// route's own comment on why this is capped. Kept well under the route's
// own MAX_BATCH (300) so a slow network round-trip never has to wait on
// the largest possible batch.
const BATCH_SIZE = 200;

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

const MAX_SUGGESTIONS = 8;

// The per-row action picker — deliberately NOT a plain <select> with every
// one of the ~1,100 COLOMBIA_CITIES entries as a static <option>, the way
// this used to work. That was fine for a handful of rows, but this page's
// whole point is showing potentially THOUSANDS of rows on real production
// data (see this file's own module comment) — a <select> with 1,100+
// <option> elements IN EVERY ROW meant a review list of ~3,000 rows was
// really ~3 MILLION <option> DOM nodes, which is what actually made the
// tab hang/crash even after the server-side computation itself got fixed
// (verified: a real headless-browser render of this many rows the old way
// never finished). The row's own small candidate list (usually 1-3 cities)
// stays a real <select> — that's genuinely cheap. Reaching for "any other
// city" now opens a bounded typeahead instead (same filter-and-cap
// approach as CityAutocomplete.tsx on the live registration form) — at
// most MAX_SUGGESTIONS <option>-equivalents exist in the DOM at once, for
// the one row currently being edited, not one full copy per row.
function CityActionPicker({
  row,
  action,
  onChange,
}: {
  row: CityCleanupRow;
  action: string;
  onChange: (value: string) => void;
}) {
  const isBuiltIn = action === "keep" || action === "blank" || row.candidates.some((c) => action === `merge:${c}`);
  const [pickingOther, setPickingOther] = useState(false);
  const [query, setQuery] = useState("");

  const selectValue = isBuiltIn ? action : "other";
  const customLabel = !isBuiltIn && action.startsWith("merge:") ? action.slice("merge:".length) : null;

  const suggestions = useMemo(() => {
    const q = normalizeCityString(query);
    if (!q) return [];
    const startsWith = COLOMBIA_CITIES.filter((c) => normalizeCityString(c.label).startsWith(q));
    const contains = COLOMBIA_CITIES.filter(
      (c) => !normalizeCityString(c.label).startsWith(q) && normalizeCityString(c.label).includes(q)
    );
    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [query]);

  function handleSelectChange(value: string) {
    if (value === "other") {
      setPickingOther(true);
      setQuery(customLabel ?? "");
      return;
    }
    setPickingOther(false);
    onChange(value);
  }

  return (
    <div>
      <select value={selectValue} onChange={(e) => handleSelectChange(e.target.value)} style={{ minWidth: 260 }}>
        <option value="keep">No cambiar</option>
        {row.candidates.map((c) => (
          <option key={c} value={`merge:${c}`}>
            Fusionar a: {c}
          </option>
        ))}
        <option value="blank">Vaciar (quitar la ciudad)</option>
        <option value="other">{customLabel ? `Otra ciudad: ${customLabel}` : "Elegir otra ciudad de la lista…"}</option>
      </select>
      {selectValue === "other" && pickingOther && (
        <div style={{ position: "relative", marginTop: 6 }}>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setTimeout(() => setPickingOther(false), 150)}
            placeholder="Buscar ciudad…"
            style={{ minWidth: 260, fontSize: 13, padding: "4px 8px" }}
          />
          {suggestions.length > 0 && (
            <ul
              role="listbox"
              style={{
                position: "absolute",
                zIndex: 20,
                top: "100%",
                left: 0,
                right: 0,
                marginTop: 2,
                maxHeight: 180,
                overflowY: "auto",
                background: "#fff",
                border: "1px solid #e3e1dc",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                padding: 4,
                listStyle: "none",
              }}
            >
              {suggestions.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setPickingOther(false);
                      onChange(`merge:${c.label}`);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "5px 8px",
                      border: "none",
                      borderRadius: 5,
                      background: "transparent",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function CityCleanupClient({ allRaw }: { allRaw: RawCity[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<CityCleanupRow[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  // Guards against React 18 Strict Mode's double-invoke of effects in
  // dev (which would otherwise fire every batch twice) and against a
  // re-run if allRaw's identity ever changed — it doesn't in practice
  // (server-rendered once per page load), but this keeps the effect
  // honestly idempotent regardless.
  const startedRef = useRef(false);

  const doneLoading = loadedCount >= allRaw.length;

  // Fetches matches in small, bounded batches instead of one request for
  // everything — see page.tsx's and the /match route's own comments on
  // why. Sequential on purpose (not fired in parallel): each batch is
  // already fast (pure in-memory computation), and going sequentially
  // means this never sends a burst of large concurrent requests at the
  // server regardless of how many distinct city values exist.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (allRaw.length === 0) return;

    let cancelled = false;

    async function loadAll() {
      for (let offset = 0; offset < allRaw.length; offset += BATCH_SIZE) {
        if (cancelled) return;
        const batch = allRaw.slice(offset, offset + BATCH_SIZE);
        try {
          const res = await fetch("/api/admin/crm/city-cleanup/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ raws: batch.map((r) => r.raw) }),
          });
          if (!res.ok) throw new Error(`status ${res.status}`);
          const body = (await res.json()) as {
            results: Omit<CityCleanupRow, "count">[];
          };
          if (cancelled) return;
          const countByRaw = new Map(batch.map((r) => [r.raw, r.count]));
          const newRows: CityCleanupRow[] = [];
          const newActions: Record<string, string> = {};
          for (const m of body.results) {
            // Skip anything already exactly a canonical label — nothing
            // to review, showing it would just be noise.
            if (m.confidence === "exact" && m.suggested === m.raw) continue;
            const row: CityCleanupRow = { ...m, count: countByRaw.get(m.raw) ?? 0 };
            newRows.push(row);
            newActions[row.raw] = defaultAction(row);
          }
          setRows((prev) => [...prev, ...newRows]);
          setActions((prev) => ({ ...prev, ...newActions }));
          setLoadedCount((prev) => prev + batch.length);
        } catch {
          if (!cancelled) setLoadError("No se pudieron cargar todos los valores — recarga la página para reintentar.");
          return;
        }
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [allRaw]);

  const totalDistinct = allRaw.length;
  const totalPeopleAffected = rows.reduce((sum, r) => sum + r.count, 0);

  const pending = useMemo(() => rows.filter((r) => actions[r.raw] && actions[r.raw] !== "keep"), [rows, actions]);
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

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Valores distintos en la base" value={String(totalDistinct)} />
        <StatCard label="Necesitan revisión" value={doneLoading ? String(rows.length) : `${rows.length}+…`} />
        <StatCard label="Personas afectadas" value={doneLoading ? String(totalPeopleAffected) : `${totalPeopleAffected}+…`} />
      </div>

      {!doneLoading && !loadError && (
        <p style={{ marginBottom: 16, fontSize: 14, color: "#5b5f6b" }}>
          Comparando valores contra la lista oficial de municipios — {loadedCount} de {totalDistinct}…
        </p>
      )}
      {loadError && <p style={{ marginBottom: 16, fontSize: 14, color: "#c2185b" }}>{loadError}</p>}

      {doneLoading && rows.length === 0 && !loadError && (
        <p style={{ color: "#5b5f6b" }}>
          No hay valores de ciudad pendientes de revisión — todo lo que hay en la base ya coincide con la lista
          oficial de municipios.
        </p>
      )}

      {rows.length > 0 && (
        <>
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
                disabled={applying || !doneLoading || autoApplicable.length === 0}
                style={{ width: "auto", padding: "8px 20px", background: "#fff", border: "1px solid #12966b", color: "#0e6b4c", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
                title={
                  doneLoading
                    ? "Solo mayúsculas/tildes, un prefijo sin ambigüedad, o claramente no es una ciudad — nunca toca un caso 'Parecido' o sin coincidencia."
                    : "Espera a que termine de cargar todos los valores antes de aplicar cambios."
                }
              >
                {applying ? "Aplicando…" : `Aplicar automáticamente lo obvio (${autoApplicable.length})`}
              </button>
              <button
                className="primary"
                type="button"
                onClick={handleApply}
                disabled={applying || !doneLoading || pending.length === 0}
                style={{ width: "auto", padding: "8px 20px" }}
                title={doneLoading ? undefined : "Espera a que termine de cargar todos los valores antes de aplicar cambios."}
              >
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
                        <CityActionPicker row={r} action={action} onChange={(value) => setAction(r.raw, value)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 12 }}>
            Nota: si algún segmento guardado filtra por uno de estos valores exactos, fusionarlo aquí puede hacer
            que ese segmento deje de encontrar a esas personas — revisa <a href="/admin/crm/segments">Segmentos</a>{" "}
            después de aplicar cambios grandes.
          </p>
        </>
      )}
    </div>
  );
}
