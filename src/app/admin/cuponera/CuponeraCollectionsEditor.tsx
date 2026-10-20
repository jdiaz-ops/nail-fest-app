"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminCollectionRow } from "@/lib/cuponera/admin";
import { CUPONERA_CATEGORIES, categoryLabel, subcategoriesOf, subcategoryLabel, type CuponeraCategory } from "@/lib/cuponera/shared";
import { api, CardTitle, cardStyle, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle } from "./ui";

const PAGE_SIZE = 40;
const CATEGORY_OPTIONS = CUPONERA_CATEGORIES.filter((c) => c.key !== "todo") as { key: CuponeraCategory; label: string }[];

function describe(category: CuponeraCategory | null, subcategory: string | null): string {
  if (!category) return "sin categoría";
  const sub = subcategoryLabel(category, subcategory);
  return sub ? `${categoryLabel(category)} › ${sub}` : categoryLabel(category);
}

// The select's value: "" pending, "ignore", "cat" or "cat/sub".
function valueOf(row: AdminCollectionRow): string {
  if (!row.mapping) return "";
  if (row.mapping.ignored) return "ignore";
  if (!row.mapping.category) return "";
  return row.mapping.subcategory ? `${row.mapping.category}/${row.mapping.subcategory}` : row.mapping.category;
}

type Item = { label: string; category?: CuponeraCategory | null; subcategory?: string | null; ignored?: boolean; clear?: boolean };

function itemFor(label: string, value: string): Item {
  if (value === "") return { label, clear: true };
  if (value === "ignore") return { label, ignored: true };
  const [category, subcategory] = value.split("/") as [CuponeraCategory, string | undefined];
  return { label, category, subcategory: subcategory ?? null };
}

// The unifier: every brand names its collections its own way ("Esmaltes
// semi", "Gel Polish", "Semipermanentes"). Each collection is mapped once
// to a cuponera category; its products — from any brand, also the ones that
// arrive later — follow it, unless one was picked for the product itself.
export default function CuponeraCollectionsEditor({ collections }: { collections: AdminCollectionRow[] }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = collections.filter((c) => !c.mapping);
  const acceptable = pending.filter((c) => c.suggestion.category);
  const list = showAll ? collections : pending;
  const shown = list.slice(0, limit);

  async function save(items: Item[], savingKey: string) {
    setSaving(savingKey);
    setError(null);
    try {
      await api("/api/admin/cuponera/collections", { method: "PUT", body: JSON.stringify({ items }) });
      router.refresh();
    } catch {
      setError("No se pudo guardar. Vuelve a intentarlo.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={cardStyle}>
      <CardTitle
        aside={
          <span style={mutedText}>
            {pending.length === 0 ? "Todas asignadas" : `${pending.length} ${pending.length === 1 ? "pendiente" : "pendientes"}`} de {collections.length}
          </span>
        }
      >
        Colecciones de las marcas
      </CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Cada marca nombra sus colecciones a su manera. Asigna cada una a una categoría de la cuponera una sola vez: todos sus productos, de
        cualquier marca y también los que lleguen después, quedan en esa categoría. Lo que elijas en un producto puntual siempre gana. Las que
        no son una categoría («Novedades», «Ofertas») márcalas como «No es una categoría».
      </p>

      {error && <p style={{ color: "#b0225c", fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        {acceptable.length > 0 && (
          <button
            type="button"
            style={primaryButtonStyle}
            disabled={saving !== null}
            onClick={() =>
              save(
                acceptable.map((c) => ({ label: c.label, category: c.suggestion.category, subcategory: c.suggestion.subcategory })),
                "all",
              )
            }
          >
            {saving === "all" ? "Guardando…" : `Aceptar ${acceptable.length === 1 ? "la sugerencia" : `las ${acceptable.length} sugerencias`}`}
          </button>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5b5f6b", cursor: "pointer" }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Ver también las ya asignadas
        </label>
      </div>

      {collections.length === 0 && <p style={{ fontSize: 13, color: "#8a8478" }}>Las marcas todavía no tienen colecciones en Marcolini.</p>}
      {collections.length > 0 && list.length === 0 && <p style={{ fontSize: 13, color: "#8a8478" }}>No hay colecciones pendientes.</p>}

      {shown.map((row) => (
        <div key={row.key} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 0", borderTop: "1px solid #f0efec" }}>
          <span style={{ flex: "1 1 260px", minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 14 }}>{row.label}</b>
              <span style={{ fontSize: 12, color: "#5b5f6b" }}>{row.productCount === 1 ? "1 producto" : `${row.productCount} productos`}</span>
              {row.mapping?.ignored && <Pill tone="grey">No es una categoría</Pill>}
            </span>
            <span style={{ display: "block", fontSize: 12, color: "#8a8478" }}>
              {row.brands.join(", ")}
              {row.otherNames.length > 0 && ` · también escrita «${row.otherNames.slice(0, 3).join("», «")}»`}
            </span>
            {!row.mapping && (
              <span style={{ display: "block", fontSize: 12, color: row.suggestion.category ? "#0d6e4f" : "#8a8478" }}>
                {row.suggestion.category ? `Sugerencia: ${describe(row.suggestion.category, row.suggestion.subcategory)}` : "Sin sugerencia"}
              </span>
            )}
            {row.conflicts.length > 0 && (
              <span style={{ display: "block", fontSize: 12, color: "#8a5a00" }}>
                Ojo: por su nombre,{" "}
                {row.conflicts
                  .slice(0, 2)
                  .map((c) => `«${c.name}» parece de ${categoryLabel(c.category)}`)
                  .join(" y ")}
                {row.conflicts.length > 2 ? ` (y ${row.conflicts.length - 2} más)` : ""}. Si hace falta, cámbialo en ese producto: lo que elijas
                ahí gana.
              </span>
            )}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 1 auto", minWidth: 0 }}>
            {!row.mapping && row.suggestion.category && (
              <button
                type="button"
                style={secondaryButtonStyle}
                disabled={saving !== null}
                onClick={() => save([{ label: row.label, category: row.suggestion.category, subcategory: row.suggestion.subcategory }], row.key)}
              >
                Aceptar
              </button>
            )}
            <select
              aria-label={`Categoría de la colección ${row.label}`}
              value={valueOf(row)}
              disabled={saving !== null}
              onChange={(e) => save([itemFor(row.label, e.target.value)], row.key)}
              style={{ padding: "7px 8px", border: "1px solid #e3e1dc", borderRadius: 8, background: "#fff", fontSize: 13, maxWidth: 260, minWidth: 0 }}
            >
              <option value="">{row.mapping ? "Volver a pendiente" : "Pendiente"}</option>
              <option value="ignore">No es una categoría</option>
              {CATEGORY_OPTIONS.map((c) => (
                <optgroup key={c.key} label={c.label}>
                  <option value={c.key}>{c.label}</option>
                  {subcategoriesOf(c.key).map((s) => (
                    <option key={s.key} value={`${c.key}/${s.key}`}>
                      {c.label} › {s.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </span>
        </div>
      ))}

      {shown.length < list.length && (
        <button type="button" style={{ ...secondaryButtonStyle, marginTop: 10 }} onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          Ver {Math.min(PAGE_SIZE, list.length - shown.length)} más
        </button>
      )}
    </div>
  );
}
