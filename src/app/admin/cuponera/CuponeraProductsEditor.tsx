"use client";

import { useMemo, useState } from "react";
import type { AdminCuponeraProduct } from "@/lib/cuponera/admin";
import {
  CUPONERA_CATEGORIES,
  CUPONERA_PROFESSIONS,
  normalizeText,
  type CuponeraCategory,
  type CuponeraProfession,
} from "@/lib/cuponera/shared";
import { api, CardTitle, cardStyle, cop, IconButton, mutedText, Pill, secondaryButtonStyle, Switch } from "./ui";

type Patch = Partial<Pick<AdminCuponeraProduct, "visible" | "featured" | "category" | "professions" | "isNew">>;
type StatusFilter = "available" | "visible" | "hidden" | "featured" | "gone";

const PAGE_SIZE = 50;
const CATEGORY_OPTIONS = CUPONERA_CATEGORIES.filter((c) => c.key !== "todo") as { key: CuponeraCategory; label: string }[];
const categoryLabel = (key: CuponeraCategory | null) => CATEGORY_OPTIONS.find((c) => c.key === key)?.label ?? "sin categoría";
const SHORT_PROFESSION: Record<CuponeraProfession, string> = { mani: "Manicurista", est: "Estudiante", salon: "Salón", casa: "En casa" };

const chipStyle = (on: boolean) => ({
  padding: "3px 10px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: on ? 700 : 400,
  color: on ? "#0b2e2c" : "#5b5f6b",
  background: on ? "#c4efeb" : "#f6f5f2",
});

// Every product of the visible brands: shown or hidden, featured (★ —
// first in the offers and in the automatic Robo del día), its category,
// who it's for ("Ofertas para lo que haces") and whether it counts as new.
// Changes save on the spot, one product or the whole selection at once.
export default function CuponeraProductsEditor({
  initialProducts,
  brands,
}: {
  initialProducts: AdminCuponeraProduct[];
  brands: { id: string; name: string }[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [brandId, setBrandId] = useState("");
  const [category, setCategory] = useState<"" | "none" | CuponeraCategory>("");
  const [status, setStatus] = useState<StatusFilter>("available");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [bulkProfessions, setBulkProfessions] = useState<CuponeraProfession[]>([]);

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    return products.filter((p) => {
      if (status === "gone" ? p.available : !p.available) return false;
      if (status === "visible" && !p.visible) return false;
      if (status === "hidden" && p.visible) return false;
      if (status === "featured" && !p.featured) return false;
      if (brandId && p.brandId !== brandId) return false;
      if (category === "none" && p.effectiveCategory !== null) return false;
      if (category && category !== "none" && p.effectiveCategory !== category) return false;
      return !q || normalizeText(`${p.name} ${p.brandName}`).includes(q);
    });
  }, [products, query, brandId, category, status]);
  const shown = filtered.slice(0, limit);
  const selectedIds = [...selected].filter((id) => filtered.some((p) => p.id === id));

  async function update(ids: string[], patch: Patch) {
    if (ids.length === 0) return;
    setError(null);
    setSavingIds((s) => new Set([...s, ...ids]));
    try {
      await api("/api/admin/cuponera/products", { method: "PATCH", body: JSON.stringify({ ids, patch }) });
      setProducts((list) =>
        list.map((p) => {
          if (!ids.includes(p.id)) return p;
          const next = { ...p, ...patch };
          // The admin's pick wins; clearing it goes back to the sync's guess.
          if ("category" in patch) next.effectiveCategory = patch.category ?? p.autoCategory;
          return next;
        }),
      );
    } catch {
      setError("No se pudo guardar el cambio. Vuelve a intentarlo.");
    } finally {
      setSavingIds((s) => new Set([...s].filter((id) => !ids.includes(id))));
    }
  }

  function toggleSelected(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const counts = {
    available: products.filter((p) => p.available).length,
    visible: products.filter((p) => p.available && p.visible).length,
  };

  return (
    <div style={cardStyle}>
      <CardTitle aside={<span style={mutedText}>{`${counts.visible} de ${counts.available} visibles`}</span>}>Productos</CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Los que las marcas tienen a la venta en Marcolini (sin agotados ni borradores). El precio con código es el de la tienda menos el
        descuento de la marca. La categoría sale sola del nombre; cámbiala si quedó mal. Sin profesiones elegidas, el producto sale para
        todas.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          type="search"
          value={query}
          placeholder="Buscar producto o marca"
          aria-label="Buscar producto o marca"
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          style={{ flex: "1 1 220px", padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8 }}
        />
        <select aria-label="Marca" value={brandId} onChange={(e) => setBrandId(e.target.value)} style={selectStyle}>
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select aria-label="Categoría" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} style={selectStyle}>
          <option value="">Todas las categorías</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
          <option value="none">Sin categoría</option>
        </select>
        <select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} style={selectStyle}>
          <option value="available">Visibles y ocultos</option>
          <option value="visible">Solo visibles</option>
          <option value="hidden">Solo ocultos</option>
          <option value="featured">Destacados ★</option>
          <option value="gone">Ya no están en Marcolini</option>
        </select>
      </div>

      {error && <p style={{ color: "#b0225c", fontSize: 13 }}>{error}</p>}

      {selectedIds.length > 0 && (
        <div style={{ background: "#f6f5f2", borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 13 }}>{selectedIds.length === 1 ? "1 seleccionado:" : `${selectedIds.length} seleccionados:`}</b>
            <button type="button" style={secondaryButtonStyle} onClick={() => update(selectedIds, { visible: true })}>
              Mostrar
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={() => update(selectedIds, { visible: false })}>
              Ocultar
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={() => update(selectedIds, { featured: true })}>
              ★ Destacar
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={() => update(selectedIds, { featured: false })}>
              Quitar ★
            </button>
            <select
              aria-label="Categoría para los seleccionados"
              value=""
              onChange={(e) => {
                const value = e.target.value;
                if (value) update(selectedIds, { category: value === "auto" ? null : (value as CuponeraCategory) });
              }}
              style={selectStyle}
            >
              <option value="">Categoría…</option>
              <option value="auto">Automática</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="button" style={{ ...secondaryButtonStyle, border: "none", background: "transparent" }} onClick={() => setSelected(new Set())}>
              Quitar selección
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13 }}>
            <span>Para:</span>
            {CUPONERA_PROFESSIONS.map((p) => {
              const on = bulkProfessions.includes(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={on}
                  style={chipStyle(on)}
                  onClick={() => setBulkProfessions((list) => (on ? list.filter((k) => k !== p.key) : [...list, p.key]))}
                >
                  {SHORT_PROFESSION[p.key]}
                </button>
              );
            })}
            <button type="button" style={secondaryButtonStyle} onClick={() => update(selectedIds, { professions: bulkProfessions })}>
              {bulkProfessions.length === 0 ? "Aplicar «para todas»" : "Aplicar"}
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8a8478" }}>{products.length === 0 ? "Todavía no hay productos: sincroniza con Marcolini." : "Ningún producto con estos filtros."}</p>
      ) : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5b5f6b", padding: "4px 0 8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={allShownSelected}
              onChange={() =>
                setSelected((s) => {
                  const next = new Set(s);
                  for (const p of shown) {
                    if (allShownSelected) next.delete(p.id);
                    else next.add(p.id);
                  }
                  return next;
                })
              }
            />
            Seleccionar los {shown.length} de la lista
          </label>

          {shown.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              selected={selected.has(p.id)}
              saving={savingIds.has(p.id)}
              onSelect={() => toggleSelected(p.id)}
              onChange={(patch) => update([p.id], patch)}
            />
          ))}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <span style={mutedText}>
              {shown.length < filtered.length ? `Mostrando ${shown.length} de ${filtered.length}` : `${filtered.length} ${filtered.length === 1 ? "producto" : "productos"}`}
            </span>
            {shown.length < filtered.length && (
              <button type="button" style={secondaryButtonStyle} onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Ver {Math.min(PAGE_SIZE, filtered.length - shown.length)} más
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const selectStyle = { padding: "8px 10px", border: "1px solid #e3e1dc", borderRadius: 8, background: "#fff", fontSize: 13 };

function ProductRow({
  product: p,
  selected,
  saving,
  onSelect,
  onChange,
}: {
  product: AdminCuponeraProduct;
  selected: boolean;
  saving: boolean;
  onSelect: () => void;
  onChange: (patch: Patch) => void;
}) {
  const autoLabel = `Automática (${categoryLabel(p.autoCategory)})`;
  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: "1px solid #f0efec", opacity: p.visible && p.available && p.brandVisible ? 1 : 0.55 }}>
      <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Seleccionar ${p.name}`} style={{ marginTop: 14 }} />
      {p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- product photo from Marcolini
        <img src={p.imageUrl} alt="" width={48} height={48} loading="lazy" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "#f6f5f2" }} />
      ) : (
        <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 8, background: "#f6f5f2", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 240px", minWidth: 0 }}>
            <a href={p.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 14, color: "#17181c" }}>
              {p.name}
            </a>
            <span style={{ display: "block", fontSize: 12, color: "#5b5f6b" }}>
              {p.brandName} · {p.priceFrom ? "desde " : ""}
              {cop(p.price)}
              {p.priceWithCode < p.price && (
                <>
                  {" → "}
                  <b style={{ color: "#17181c" }}>{cop(p.priceWithCode)}</b> con código
                </>
              )}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, flex: "0 1 auto", minWidth: 0 }}>
            <select
              aria-label={`Categoría de ${p.name}`}
              value={p.category ?? ""}
              disabled={saving}
              onChange={(e) => onChange({ category: e.target.value ? (e.target.value as CuponeraCategory) : null })}
              style={{ ...selectStyle, padding: "6px 8px", maxWidth: 230, minWidth: 0, flex: "0 1 auto" }}
            >
              <option value="">{autoLabel}</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <IconButton title={p.featured ? "Quitar de destacados" : "Destacar"} active={p.featured} disabled={saving} onClick={() => onChange({ featured: !p.featured })}>
              <span style={{ color: p.featured ? "#e0a100" : "#c9c6bd" }}>★</span>
            </IconButton>
            <Switch checked={p.visible} disabled={saving} label={p.visible ? "Visible en la cuponera" : "Oculto de la cuponera"} onChange={(next) => onChange({ visible: next })} />
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {!p.available && <Pill tone="grey">Ya no está en Marcolini</Pill>}
          {p.available && !p.brandVisible && <Pill tone="grey">Marca oculta</Pill>}
          <span style={{ fontSize: 12, color: "#8a8478" }}>Para:</span>
          {CUPONERA_PROFESSIONS.map((prof) => {
            const on = p.professions.includes(prof.key);
            return (
              <button
                key={prof.key}
                type="button"
                aria-pressed={on}
                disabled={saving}
                style={chipStyle(on)}
                onClick={() => onChange({ professions: on ? p.professions.filter((k) => k !== prof.key) : [...p.professions, prof.key] })}
              >
                {SHORT_PROFESSION[prof.key]}
              </button>
            );
          })}
          {p.professions.length === 0 && <span style={{ fontSize: 12, color: "#8a8478" }}>(todas)</span>}
          <span style={{ flex: 1 }} />
          <label style={{ fontSize: 12, color: "#5b5f6b", display: "flex", alignItems: "center", gap: 6 }}>
            Nuevo:
            <select
              value={p.isNew === null ? "auto" : p.isNew ? "yes" : "no"}
              disabled={saving}
              onChange={(e) => onChange({ isNew: e.target.value === "auto" ? null : e.target.value === "yes" })}
              style={{ ...selectStyle, padding: "4px 6px", fontSize: 12 }}
            >
              <option value="auto">Automático</option>
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
