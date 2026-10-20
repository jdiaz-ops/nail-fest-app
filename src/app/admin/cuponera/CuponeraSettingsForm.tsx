"use client";

import { useState } from "react";
import { api, CardTitle, cardStyle, mutedText, primaryButtonStyle, Switch } from "./ui";

interface SettingsValue {
  published: boolean;
  heroTitle: string | null;
  heroLede: string | null;
  showDeal: boolean;
  showCoupons: boolean;
  showNew: boolean;
  newTitle: string | null;
  newSubtitle: string | null;
  newDays: number;
}

type Status = "idle" | "saving" | "saved" | "invalid" | "error";

// Publication (its own switch, saved on the spot) and the page's texts and
// sections (saved with the button).
export default function CuponeraSettingsForm({
  initial,
  defaults,
  hasProducts,
}: {
  initial: SettingsValue;
  defaults: { heroTitle: string; heroLede: string; newTitle: string; newSubtitle: string };
  hasProducts: boolean;
}) {
  const [published, setPublished] = useState(initial.published);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [form, setForm] = useState({
    heroTitle: initial.heroTitle ?? "",
    heroLede: initial.heroLede ?? "",
    showDeal: initial.showDeal,
    showCoupons: initial.showCoupons,
    showNew: initial.showNew,
    newTitle: initial.newTitle ?? "",
    newSubtitle: initial.newSubtitle ?? "",
    newDays: String(initial.newDays),
  });
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
    const newDays = Number(form.newDays);
    if (!Number.isInteger(newDays) || newDays < 1 || newDays > 365) {
      setStatus("invalid");
      return;
    }
    setStatus("saving");
    try {
      await api("/api/admin/cuponera/settings", {
        method: "PATCH",
        body: JSON.stringify({
          heroTitle: form.heroTitle,
          heroLede: form.heroLede,
          showDeal: form.showDeal,
          showCoupons: form.showCoupons,
          showNew: form.showNew,
          newTitle: form.newTitle,
          newSubtitle: form.newSubtitle,
          newDays,
        }),
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  };

  const checkbox = (key: "showDeal" | "showCoupons" | "showNew", label: string, hint: string) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 10 }}>
      <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        <span style={{ display: "block", ...mutedText, fontSize: 12 }}>{hint}</span>
      </span>
    </label>
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
        <p style={{ ...mutedText, marginTop: 0 }}>Vacío = el texto de siempre (el que se ve en gris).</p>

        <div className="field">
          <label htmlFor="cup-hero-title">Título</label>
          <input id="cup-hero-title" value={form.heroTitle} maxLength={120} placeholder={defaults.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cup-hero-lede">Texto debajo del título</label>
          <textarea id="cup-hero-lede" rows={2} value={form.heroLede} maxLength={300} placeholder={defaults.heroLede} onChange={(e) => set("heroLede", e.target.value)} />
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "#5b5f6b", margin: "4px 0 10px" }}>Secciones</div>
        {checkbox("showDeal", "Robo del día", "Un producto con cuenta regresiva arriba, al lado del buscador.")}
        {checkbox("showCoupons", "Cupones de las marcas", "Una tarjeta por marca con su código para copiar.")}
        {checkbox("showNew", "Lo nuevo", "Los productos que llegaron hace poco a las tiendas de las marcas.")}

        {form.showNew && (
          <div style={{ borderLeft: "3px solid #e6f9f7", paddingLeft: 14, marginTop: 6 }}>
            <div className="field">
              <label htmlFor="cup-new-title">Título de «Lo nuevo»</label>
              <input id="cup-new-title" value={form.newTitle} maxLength={120} placeholder={defaults.newTitle} onChange={(e) => set("newTitle", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cup-new-sub">Texto de «Lo nuevo»</label>
              <input id="cup-new-sub" value={form.newSubtitle} maxLength={200} placeholder={defaults.newSubtitle} onChange={(e) => set("newSubtitle", e.target.value)} />
            </div>
            <div className="field" style={{ maxWidth: 260 }}>
              <label htmlFor="cup-new-days">Cuenta como nuevo lo de los últimos (días)</label>
              <input id="cup-new-days" type="number" min={1} max={365} value={form.newDays} onChange={(e) => set("newDays", e.target.value)} />
            </div>
          </div>
        )}

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
