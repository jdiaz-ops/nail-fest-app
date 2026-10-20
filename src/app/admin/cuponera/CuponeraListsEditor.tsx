"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminCuponeraList } from "@/lib/cuponera/admin";
import { CUPONERA_CATEGORIES, categoryLabel, normalizeText, subcategoriesOf, subcategoryLabel, type CuponeraCategory } from "@/lib/cuponera/shared";
import { api, CardTitle, cardStyle, IconButton, Modal, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle, Switch } from "./ui";

const CATEGORY_OPTIONS = CUPONERA_CATEGORIES.filter((c) => c.key !== "todo") as { key: CuponeraCategory; label: string }[];
const MAX_PRODUCTS = 40;
const SEARCH_RESULTS = 8;

export interface ListProductOption {
  id: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
}

type ListForm = {
  title: string;
  subtitle: string;
  kind: "category" | "products";
  /** "" none, "cat" or "cat/sub". */
  where: string;
  productIds: string[];
};

function whereOf(list: AdminCuponeraList): string {
  if (!list.category) return "";
  return list.subcategory ? `${list.category}/${list.subcategory}` : list.category;
}

function describe(list: AdminCuponeraList): string {
  if (list.kind === "products") return list.productIds.length === 1 ? "1 producto elegido" : `${list.productIds.length} productos elegidos`;
  const sub = subcategoryLabel(list.category, list.subcategory);
  return `Categoría: ${categoryLabel(list.category)}${sub ? ` › ${sub}` : ""}`;
}

// "Listas de la portada": the rows that slide on the front page below the
// search, in this order — a category (it fills itself) or products picked
// one by one ("Para empezar en acrílico"), each with its own page.
export default function CuponeraListsEditor({ lists, products }: { lists: AdminCuponeraList[]; products: ListProductOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCuponeraList | "new" | null>(null);

  async function run(action: () => Promise<unknown>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
      return true;
    } catch {
      setError(failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(form: ListForm) {
    const [category, subcategory] = form.where ? form.where.split("/") : [null, null];
    const body = {
      title: form.title,
      subtitle: form.subtitle,
      kind: form.kind,
      category: form.kind === "category" ? category : null,
      subcategory: form.kind === "category" ? (subcategory ?? null) : null,
      productIds: form.kind === "products" ? form.productIds : [],
    };
    const ok = await run(
      () =>
        editing === "new" || editing === null
          ? api("/api/admin/cuponera/lists", { method: "POST", body: JSON.stringify(body) })
          : api(`/api/admin/cuponera/lists/${editing.id}`, { method: "PATCH", body: JSON.stringify({ ...body, visible: editing.visible }) }),
      "No se pudo guardar la lista.",
    );
    if (ok) setEditing(null);
  }

  return (
    <div style={cardStyle}>
      <CardTitle
        aside={
          <button type="button" style={primaryButtonStyle} disabled={busy} onClick={() => setEditing("new")}>
            Nueva lista
          </button>
        }
      >
        Listas de la portada
      </CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Las filas que se deslizan en la portada, debajo de la búsqueda, en este orden; «Lo más comprado» va antes y «Lo nuevo» después (se
        prenden y apagan en Textos y secciones). Una lista de una categoría se llena sola con los productos de todas las marcas; en una de
        productos eliges cuáles y en qué orden. Cada lista tiene su página con «Ver todo».
      </p>
      {error && <p style={{ color: "#b0225c", fontSize: 13 }}>{error}</p>}
      {lists.length === 0 && <p style={{ fontSize: 13, color: "#8a8478" }}>Todavía no hay listas.</p>}

      {lists.map((l, i) => (
        <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid #f0efec", opacity: l.visible ? 1 : 0.55 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 14 }}>{l.title}</b>
              {l.visible && !l.shows && <Pill tone="amber">No se ve: {l.kind === "category" ? "necesita 2 productos" : "sin productos visibles"}</Pill>}
            </span>
            <span style={{ display: "block", fontSize: 12, color: "#5b5f6b" }}>
              {describe(l)} · {l.productCount === 1 ? "1 producto se ve" : `${l.productCount} productos se ven`}
              {l.subtitle ? ` · «${l.subtitle}»` : ""}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <IconButton title="Editar la lista" onClick={() => setEditing(l)} disabled={busy}>
              ✏️
            </IconButton>
            <IconButton
              title="Subir"
              onClick={() => run(() => api(`/api/admin/cuponera/lists/${l.id}/move`, { method: "POST", body: JSON.stringify({ direction: "up" }) }), "No se pudo mover la lista.")}
              disabled={busy || i === 0}
            >
              ↑
            </IconButton>
            <IconButton
              title="Bajar"
              onClick={() => run(() => api(`/api/admin/cuponera/lists/${l.id}/move`, { method: "POST", body: JSON.stringify({ direction: "down" }) }), "No se pudo mover la lista.")}
              disabled={busy || i === lists.length - 1}
            >
              ↓
            </IconButton>
            <IconButton
              title="Borrar la lista"
              onClick={() => {
                if (confirm(`¿Borrar la lista «${l.title}»? Los productos no se borran.`)) {
                  void run(() => api(`/api/admin/cuponera/lists/${l.id}`, { method: "DELETE" }), "No se pudo borrar la lista.");
                }
              }}
              disabled={busy}
            >
              🗑
            </IconButton>
            <Switch
              checked={l.visible}
              disabled={busy}
              label={l.visible ? "Visible en la portada" : "Oculta de la portada"}
              onChange={(next) => run(() => api(`/api/admin/cuponera/lists/${l.id}`, { method: "PATCH", body: JSON.stringify({ visible: next }) }), "No se pudo cambiar.")}
            />
          </span>
        </div>
      ))}

      {editing && (
        <Modal title={editing === "new" ? "Nueva lista" : `Editar «${editing.title}»`} onClose={() => setEditing(null)}>
          <ListEditForm list={editing === "new" ? null : editing} products={products} busy={busy} onCancel={() => setEditing(null)} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

function ListEditForm({
  list,
  products,
  busy,
  onCancel,
  onSave,
}: {
  list: AdminCuponeraList | null;
  products: ListProductOption[];
  busy: boolean;
  onCancel: () => void;
  onSave: (form: ListForm) => void;
}) {
  const [form, setForm] = useState<ListForm>({
    title: list?.title ?? "",
    subtitle: list?.subtitle ?? "",
    kind: list?.kind ?? "category",
    where: list ? whereOf(list) : "",
    productIds: list?.productIds ?? [],
  });
  const [query, setQuery] = useState("");
  const set = <K extends keyof ListForm>(key: K, value: ListForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const byId = new Map(products.map((p) => [p.id, p]));
  const q = normalizeText(query);
  const results = q
    ? products.filter((p) => !form.productIds.includes(p.id) && normalizeText(`${p.name} ${p.brandName}`).includes(q)).slice(0, SEARCH_RESULTS)
    : [];
  const move = (index: number, delta: number) => {
    const ids = [...form.productIds];
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id!);
    set("productIds", ids);
  };
  const valid = form.title.trim() !== "" && (form.kind === "category" ? form.where !== "" : form.productIds.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="field">
        <label htmlFor="cup-list-title">Título</label>
        <input id="cup-list-title" value={form.title} maxLength={80} placeholder="Para empezar en acrílico" onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="cup-list-sub">Texto debajo (opcional)</label>
        <input id="cup-list-sub" value={form.subtitle} maxLength={140} placeholder="Una lista de Nail Fest" onChange={(e) => set("subtitle", e.target.value)} />
      </div>

      <div role="radiogroup" aria-label="Qué productos tiene" style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 12px" }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 14 }}>
          <input type="radio" name="cup-list-kind" checked={form.kind === "category"} onChange={() => set("kind", "category")} />
          <span>
            <b>Una categoría</b> <span style={mutedText}>— se llena sola</span>
          </span>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 14 }}>
          <input type="radio" name="cup-list-kind" checked={form.kind === "products"} onChange={() => set("kind", "products")} />
          <span>
            <b>Productos que eliges</b> <span style={mutedText}>— en tu orden</span>
          </span>
        </label>
      </div>

      {form.kind === "category" ? (
        <div className="field">
          <label htmlFor="cup-list-where">Categoría</label>
          <select id="cup-list-where" value={form.where} onChange={(e) => set("where", e.target.value)}>
            <option value="">Elige una…</option>
            {CATEGORY_OPTIONS.map((c) => (
              <optgroup key={c.key} label={c.label}>
                <option value={c.key}>{c.label} (todo)</option>
                {subcategoriesOf(c.key).map((s) => (
                  <option key={s.key} value={`${c.key}/${s.key}`}>
                    {c.label} › {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <div className="field" style={{ marginBottom: 6 }}>
            <label htmlFor="cup-list-q">Agregar productos</label>
            <input id="cup-list-q" type="search" value={query} placeholder="Busca por nombre o marca" autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
          </div>
          {results.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {p.name} <span style={{ color: "#8a8478" }}>— {p.brandName}</span>
              </span>
              <button
                type="button"
                style={{ ...secondaryButtonStyle, padding: "4px 12px" }}
                disabled={form.productIds.length >= MAX_PRODUCTS}
                onClick={() => {
                  set("productIds", [...form.productIds, p.id]);
                  setQuery("");
                }}
              >
                Agregar
              </button>
            </div>
          ))}
          {q && results.length === 0 && <p style={{ ...mutedText, fontSize: 12, margin: "4px 0" }}>Ningún producto visible se llama así.</p>}

          <div style={{ fontSize: 13, fontWeight: 600, color: "#5b5f6b", margin: "10px 0 4px" }}>
            En la lista ({form.productIds.length}/{MAX_PRODUCTS})
          </div>
          {form.productIds.length === 0 && <p style={{ ...mutedText, fontSize: 12, margin: 0 }}>Todavía ninguno.</p>}
          {form.productIds.map((id, i) => {
            const p = byId.get(id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", fontSize: 13, borderTop: i ? "1px solid #f0efec" : "none" }}>
                <span style={{ width: 20, color: "#8a8478" }}>{i + 1}.</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {p ? (
                    <>
                      {p.name} <span style={{ color: "#8a8478" }}>— {p.brandName}</span>
                    </>
                  ) : (
                    <span style={{ color: "#8a8478" }}>Producto que ya no se ve (no sale en la lista)</span>
                  )}
                </span>
                <IconButton title="Subir" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </IconButton>
                <IconButton title="Bajar" onClick={() => move(i, 1)} disabled={i === form.productIds.length - 1}>
                  ↓
                </IconButton>
                <IconButton title="Quitar de la lista" onClick={() => set("productIds", form.productIds.filter((x) => x !== id))}>
                  ✕
                </IconButton>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
          Cancelar
        </button>
        <button type="button" disabled={busy || !valid} onClick={() => onSave(form)} style={{ ...primaryButtonStyle, opacity: valid ? 1 : 0.5 }}>
          Guardar
        </button>
      </div>
    </div>
  );
}
