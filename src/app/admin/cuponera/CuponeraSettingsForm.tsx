"use client";

import { useState, type ReactNode } from "react";
import { api, CardTitle, cardStyle, mutedText, primaryButtonStyle, Switch } from "./ui";

interface SettingsValue {
  published: boolean;
  heroTitle: string | null;
  heroLede: string | null;
  showDeal: boolean;
  showCoupons: boolean;
  showNew: boolean;
  showBestsellers: boolean;
  heroStyle: string;
  panelTitle: string | null;
  showCategories: boolean;
  categoriesTitle: string | null;
  bestsellersTitle: string | null;
  bestsellersSubtitle: string | null;
  newTitle: string | null;
  newSubtitle: string | null;
  newDays: number;
  showAllBrands: boolean;
  allBrandsTitle: string | null;
  allBrandsSubtitle: string | null;
}

type Texts = {
  heroTitle: string;
  heroLede: string;
  panelTitle: string;
  categoriesTitle: string;
  bestsellersTitle: string;
  bestsellersSubtitle: string;
  newTitle: string;
  newSubtitle: string;
  allBrandsTitle: string;
  allBrandsSubtitle: string;
};

type TextKey = keyof Texts;
type SwitchKey = "showCoupons" | "showCategories" | "showBestsellers" | "showNew" | "showAllBrands";
type Status = "idle" | "saving" | "saved" | "invalid" | "error";

const HERO_STYLES = [
  ["cupones", "Panel con cupones", "Cada marca como un cupón: descuento, código y botón a la tienda; se deslizan con el dedo (como Student Beans)."],
  ["panel", "Panel con filas", "Tres marcas por columna, con su descuento y su código; se desliza con el dedo (como Student Beans)."],
  ["marcas", "Logos que se mueven solos", "Filas de logos que pasan hacia la izquierda, con el % y el código debajo (como Rakuten)."],
] as const;

// Publication (its own switch, saved on the spot) and the page's texts and
// sections, top to bottom as the page shows them (saved with the button).
// An empty text is the usual one, shown in gray.
export default function CuponeraSettingsForm({ initial, defaults, hasProducts }: { initial: SettingsValue; defaults: Texts; hasProducts: boolean }) {
  const [published, setPublished] = useState(initial.published);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [texts, setTexts] = useState<Record<TextKey, string>>({
    heroTitle: initial.heroTitle ?? "",
    heroLede: initial.heroLede ?? "",
    panelTitle: initial.panelTitle ?? "",
    categoriesTitle: initial.categoriesTitle ?? "",
    bestsellersTitle: initial.bestsellersTitle ?? "",
    bestsellersSubtitle: initial.bestsellersSubtitle ?? "",
    newTitle: initial.newTitle ?? "",
    newSubtitle: initial.newSubtitle ?? "",
    allBrandsTitle: initial.allBrandsTitle ?? "",
    allBrandsSubtitle: initial.allBrandsSubtitle ?? "",
  });
  const [switches, setSwitches] = useState<Record<SwitchKey, boolean>>({
    showCoupons: initial.showCoupons,
    showCategories: initial.showCategories,
    showBestsellers: initial.showBestsellers,
    showNew: initial.showNew,
    showAllBrands: initial.showAllBrands,
  });
  const [heroStyle, setHeroStyle] = useState<string>(HERO_STYLES.some(([v]) => v === initial.heroStyle) ? initial.heroStyle : "cupones");
  const [newDays, setNewDays] = useState(String(initial.newDays));
  const [status, setStatus] = useState<Status>("idle");

  async function togglePublished(next: boolean) {
    if (next && !confirm("¿Publicar la cuponera? Cualquier persona podrá verla en nailfest.lat/cuponera.")) return;
    if (!next && !confirm("¿Volver a ocultarla? Solo el equipo podrá verla.")) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await api("/api/admin/cuponera/settings", { method: "PATCH", body: JSON.stringify({ published: next }) });
      setPublished(next);
    } catch {
      setPublishError("No se pudo cambiar. Vuelve a intentarlo.");
    } finally {
      setPublishing(false);
    }
  }

  async function save() {
    const days = Number(newDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setStatus("invalid");
      return;
    }
    setStatus("saving");
    try {
      await api("/api/admin/cuponera/settings", {
        method: "PATCH",
        body: JSON.stringify({ ...texts, ...switches, heroStyle, newDays: days }),
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const changed = () => setStatus("idle");

  const text = (key: TextKey, label: string, max = 120) => (
    <div className="field">
      <label htmlFor={`cup-${key}`}>{label}</label>
      <input
        id={`cup-${key}`}
        value={texts[key]}
        maxLength={max}
        placeholder={defaults[key]}
        onChange={(e) => {
          const value = e.target.value;
          setTexts((t) => ({ ...t, [key]: value }));
          changed();
        }}
      />
    </div>
  );

  const toggle = (key: SwitchKey, label: string, hint: string) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 10 }}>
      <input
        type="checkbox"
        checked={switches[key]}
        onChange={(e) => {
          const value = e.target.checked;
          setSwitches((s) => ({ ...s, [key]: value }));
          changed();
        }}
        style={{ marginTop: 3 }}
      />
      <span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        <span style={{ display: "block", ...mutedText, fontSize: 12 }}>{hint}</span>
      </span>
    </label>
  );

  const nested = (children: ReactNode) => <div style={{ borderLeft: "3px solid #e6f9f7", paddingLeft: 14, margin: "-2px 0 12px" }}>{children}</div>;

  const section = (title: string, children: ReactNode) => (
    <div style={{ borderTop: "1px solid #efece7", paddingTop: 14, marginTop: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#5b5f6b", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>
      {children}
    </div>
  );

  return (
    <>
      <div style={cardStyle}>
        <CardTitle
          aside={<Switch checked={published} disabled={publishing} label={published ? "Cuponera pública" : "Cuponera oculta"} onChange={togglePublished} />}
        >
          Publicación
        </CardTitle>
        <p style={{ ...mutedText, margin: 0 }}>
          {published
            ? "Pública: cualquier persona la ve en nailfest.lat/cuponera."
            : "Oculta: solo el equipo con sesión iniciada la ve; las demás personas ven «página no encontrada»."}
          {!hasProducts && " Mientras no llegue el catálogo de Marcolini se ve la versión de ejemplo, y esa nunca se muestra al público."}
        </p>
        {publishError && <p style={{ color: "#b0225c", fontSize: 13, marginBottom: 0 }}>{publishError}</p>}
      </div>

      <div style={cardStyle}>
        <CardTitle>Textos y secciones</CardTitle>
        <p style={{ ...mutedText, marginTop: 0 }}>De arriba abajo, como se ven en la portada. Vacío = el texto de siempre (el que se ve en gris).</p>

        {section(
          "Arriba",
          <>
            {text("heroTitle", "Título")}
            <div className="field">
              <label htmlFor="cup-heroLede">Texto debajo del título</label>
              <textarea
                id="cup-heroLede"
                rows={2}
                value={texts.heroLede}
                maxLength={300}
                placeholder={defaults.heroLede}
                onChange={(e) => {
                  const value = e.target.value;
                  setTexts((t) => ({ ...t, heroLede: value }));
                  changed();
                }}
              />
            </div>
            {toggle("showCoupons", "Las marcas, arriba", "Debajo del título, cada marca con su descuento y su código; al tocarla se copia el código y se abre su tienda.")}
            {switches.showCoupons &&
              nested(
                <>
                  <div role="radiogroup" aria-label="Cómo se ven las marcas arriba">
                    {HERO_STYLES.map(([value, label, hint]) => (
                      <label key={value} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 8 }}>
                        <input
                          type="radio"
                          name="cup-hero-style"
                          checked={heroStyle === value}
                          onChange={() => {
                            setHeroStyle(value);
                            changed();
                          }}
                          style={{ marginTop: 3 }}
                        />
                        <span>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                          <span style={{ display: "block", ...mutedText, fontSize: 12 }}>{hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {heroStyle !== "marcas" && text("panelTitle", "Título del panel")}
                </>,
              )}
          </>,
        )}

        {section(
          "Categorías",
          <>
            {toggle("showCategories", "Cuadros de categorías", "Debajo de la búsqueda; cada cuadro abre la colección con los productos de todas las marcas. Las imágenes se suben en «Categorías de la portada».")}
            {switches.showCategories && nested(text("categoriesTitle", "Título"))}
          </>,
        )}

        {section(
          "Lo más comprado",
          <>
            {toggle(
              "showBestsellers",
              "Lo más comprado",
              "Lo que más se ha comprado con los códigos de Nail Fest en los últimos 3 meses (sin mostrar cifras). Aparece cuando hay al menos 3 productos vendidos.",
            )}
            {switches.showBestsellers &&
              nested(
                <>
                  {text("bestsellersTitle", "Título")}
                  {text("bestsellersSubtitle", "Texto", 200)}
                </>,
              )}
          </>,
        )}

        {section("Listas", <p style={{ ...mutedText, margin: "0 0 4px", fontSize: 13 }}>Van después de «Lo más comprado». Se crean, ordenan y ocultan en «Listas de la portada».</p>)}

        {section(
          "Lo nuevo",
          <>
            {toggle("showNew", "Lo nuevo", "Los productos que llegaron hace poco a las tiendas de las marcas.")}
            {switches.showNew &&
              nested(
                <>
                  {text("newTitle", "Título")}
                  {text("newSubtitle", "Texto", 200)}
                  <div className="field" style={{ maxWidth: 260 }}>
                    <label htmlFor="cup-new-days">Cuenta como nuevo lo de los últimos (días)</label>
                    <input
                      id="cup-new-days"
                      type="number"
                      min={1}
                      max={365}
                      value={newDays}
                      onChange={(e) => {
                        setNewDays(e.target.value);
                        changed();
                      }}
                    />
                  </div>
                </>,
              )}
          </>,
        )}

        {section(
          "Todas las marcas",
          <>
            {toggle("showAllBrands", "Todas las marcas, al final", "Cada marca con su logo, su descuento y su código, directo a su tienda.")}
            {switches.showAllBrands &&
              nested(
                <>
                  {text("allBrandsTitle", "Título")}
                  {text("allBrandsSubtitle", "Texto", 200)}
                </>,
              )}
          </>,
        )}

        <p style={{ ...mutedText, fontSize: 12, margin: "4px 0 14px" }}>
          El aviso de que los códigos solo sirven en la tienda en línea va siempre en el menú y en el pie de página.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={save} disabled={status === "saving"} style={primaryButtonStyle}>
            {status === "saving" ? "Guardando…" : "Guardar"}
          </button>
          {status === "saved" && <span style={{ color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
          {status === "invalid" && <span style={{ color: "#b0225c", fontSize: 14 }}>Los días tienen que ser un número de 1 a 365.</span>}
          {status === "error" && <span style={{ color: "#b0225c", fontSize: 14 }}>No se pudo guardar. Vuelve a intentarlo.</span>}
        </div>
      </div>
    </>
  );
}
