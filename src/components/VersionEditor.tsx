"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/imageCompression";
import CopyLinkButton from "./CopyLinkButton";

// One version of the event's page (2026-10-30, «Versiones de la landing»):
// its name and link, its own cover where it differs from the main page's,
// its special price per stage with a maximum, and its dates — and, once
// saved, its QR to print. What's left empty is the main page's.

export interface VersionDraft {
  id: string | null;
  name: string;
  slug: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  buttonLabel: string;
  specialPrices: Record<string, number>;
  priceLabel: string;
  maxSpecialSales: number | null;
}

interface Stage {
  id: string;
  name: string;
  price: number;
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: 18, marginBottom: 14 };
const hint: React.CSSProperties = { fontSize: 12.5, color: "#5b5f6b", margin: "4px 0 0" };
const secondary: React.CSSProperties = { background: "#fff", border: "1px solid #e3e1dc", borderRadius: 8, color: "#17181c", fontWeight: 600, cursor: "pointer", padding: "9px 14px", textAlign: "center", textDecoration: "none", fontSize: 14 };
const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

export default function VersionEditor({
  eventId,
  initial,
  stages,
  baseUrl,
  mainCapNote,
}: {
  eventId: string;
  initial: VersionDraft;
  stages: Stage[];
  /** nailfest.lat, as the links show it. */
  baseUrl: string;
  /** «No cuentan en los 200 cupos de la Etapa Creyente.» */
  mainCapNote: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [special, setSpecial] = useState(Object.keys(initial.specialPrices).length > 0);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial.specialPrices).map(([id, p]) => [id, String(p)]))
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof VersionDraft>(key: K, value: VersionDraft[K]) => setV((d) => ({ ...d, [key]: value }));
  const host = baseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", await compressImage(file, { maxDimension: 1600, quality: 0.85 }));
    const res = await fetch("/api/admin/uploads/event-image", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok && body.url) set("imageUrl", body.url);
    else setMessage({ ok: false, text: body.message ?? "No se pudo subir la foto." });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const specialPrices: Record<string, number> = {};
    if (special) {
      for (const [id, raw] of Object.entries(prices)) {
        const n = Number(String(raw).replace(/[^\d]/g, ""));
        if (n > 0) specialPrices[id] = n;
      }
    }
    const body = {
      name: v.name,
      slug: v.slug,
      enabled: v.enabled,
      startsAt: v.startsAt || null,
      endsAt: v.endsAt || null,
      title: v.title,
      subtitle: v.subtitle,
      imageUrl: v.imageUrl,
      buttonLabel: v.buttonLabel,
      specialPrices,
      priceLabel: special ? v.priceLabel : null,
      maxSpecialSales: special ? v.maxSpecialSales : null,
    };
    const res = await fetch(v.id ? `/api/admin/events/${eventId}/versions/${v.id}` : `/api/admin/events/${eventId}/versions`, {
      method: v.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const answer = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage({ ok: false, text: answer.message ?? "No se pudo guardar." });
      return;
    }
    if (!v.id) {
      router.push(`/admin/events/${eventId}/versiones/${answer.id}`);
      return;
    }
    setMessage({ ok: true, text: "Guardado." });
    router.refresh();
  }

  const link = `${baseUrl.replace(/\/+$/, "")}/v/${v.slug}`;
  const qr = v.id ? `/api/admin/events/${eventId}/versions/${v.id}/qr` : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 24, alignItems: "start", maxWidth: 1040 }}>
      <div>
        <div style={card}>
          <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Nombre y enlace</h2>
          <div className="field">
            <label>Nombre (solo lo ve el equipo)</label>
            <input
              value={v.name}
              onChange={(e) => {
                const name = e.target.value;
                setV((d) => ({ ...d, name, ...(slugTouched ? {} : { slug: slugify(name) }) }));
              }}
              placeholder="Flyer Expo Belleza Cali"
            />
          </div>
          <div className="field">
            <label>Enlace</label>
            <div style={{ display: "flex" }}>
              <span style={{ padding: "10px 10px", border: "1px solid #e3e1dc", borderRight: "none", borderRadius: "8px 0 0 8px", background: "#f0efec", color: "#5b5f6b", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14, whiteSpace: "nowrap" }}>
                {host}/v/
              </span>
              <input
                value={v.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
                style={{ borderRadius: "0 8px 8px 0", fontFamily: "ui-monospace, Menlo, monospace" }}
                placeholder="expo-cali"
              />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={v.enabled} onChange={(e) => set("enabled", e.target.checked)} style={{ width: 16, height: 16 }} />
            Activa
          </label>
          <p style={hint}>Pausada, su enlace y su QR llevan a la página principal, con el precio normal.</p>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Portada</h2>
          <p style={hint}>Para probar otro mensaje con una pauta, o hablarle directo a quien viene del flyer. Lo que dejes vacío sale igual que en la página principal.</p>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Título</label>
            <input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="¿Viniste a la Expo? Este precio es solo para ti" />
          </div>
          <div className="field">
            <label>Bajada</label>
            <textarea value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} rows={2} placeholder="Vacío: la de la página principal" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Foto de portada</label>
              <input value={v.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="Vacío: la de la página principal" />
              <label style={{ ...secondary, display: "inline-block", marginTop: 6, fontSize: 13, padding: "6px 12px", fontWeight: 600, color: "#17181c" }}>
                {uploading ? "Subiendo…" : "Subir foto"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
            <div className="field">
              <label>Texto del botón</label>
              <input value={v.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} placeholder="Vacío: el de la página principal" />
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Precio especial</h2>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              <input type="checkbox" checked={special} onChange={(e) => setSpecial(e.target.checked)} style={{ width: 16, height: 16 }} />
              {special ? "Activado" : "Desactivado"}
            </label>
          </div>
          <p style={hint}>Solo se cobra a quien llega por este enlace, mientras la versión esté activa. Cada etapa tiene su precio especial, o ninguno: vacío es el precio normal. Se paga en pesos.</p>
          {special && (
            <>
              <table style={{ width: "100%", marginTop: 10, borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 12, color: "#5b5f6b" }}>
                    <th style={{ padding: "0 0 6px" }}>Etapa</th>
                    <th style={{ padding: "0 0 6px" }}>Precio normal</th>
                    <th style={{ padding: "0 0 6px" }}>Precio en esta versión</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s) => (
                    <tr key={s.id} style={{ borderTop: "1px solid #e3e1dc" }}>
                      <td style={{ padding: "8px 0", fontWeight: 600 }}>{s.name}</td>
                      <td style={{ padding: "8px 0", color: "#5b5f6b", fontVariantNumeric: "tabular-nums" }}>{pesos(s.price)}</td>
                      <td style={{ padding: "8px 0" }}>
                        <input
                          inputMode="numeric"
                          value={prices[s.id] ?? ""}
                          onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value.replace(/[^\d]/g, "") }))}
                          placeholder="Precio normal"
                          style={{ width: 160, padding: "8px 10px", border: "1px solid #e3e1dc", borderRadius: 8 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div className="field">
                  <label>Cómo se llama en la página</label>
                  <input value={v.priceLabel} onChange={(e) => set("priceLabel", e.target.value)} placeholder="Precio Expo Belleza" />
                </div>
                <div className="field">
                  <label>Máximo de boletas a este precio</label>
                  <input
                    inputMode="numeric"
                    value={v.maxSpecialSales ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^\d]/g, ""));
                      set("maxSpecialSales", n > 0 ? n : null);
                    }}
                    placeholder="Sin límite"
                  />
                </div>
              </div>
              <p style={hint}>{mainCapNote} Al llegar al máximo, la versión muestra el precio normal.</p>
            </>
          )}
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Vigencia</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Desde</label>
              <input type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div className="field">
              <label>Hasta</label>
              <input type="datetime-local" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            </div>
          </div>
          <p style={hint}>Hora Colombia. Vacío: desde ya y sin fin. Cuando vence, el QR sigue sirviendo: lleva a la página principal con el precio normal.</p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="primary" type="button" onClick={save} disabled={saving} style={{ width: "auto", padding: "10px 24px" }}>
            {saving ? "Guardando…" : v.id ? "Guardar cambios" : "Guardar versión"}
          </button>
          {v.id && (
            <a href={`/v/${initial.slug}`} target="_blank" rel="noreferrer" style={secondary}>
              Ver la página
            </a>
          )}
          {message && <span style={{ fontSize: 14, color: message.ok ? "#1f7a4d" : "#c2185b" }}>{message.text}</span>}
        </div>
      </div>

      <div style={{ ...card, position: "sticky", top: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#5b5f6b" }}>QR PARA IMPRIMIR</p>
        {qr ? (
          <>
            <div style={{ display: "grid", placeItems: "center", padding: 14, border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the QR, drawn by our own route */}
              <img src={`${qr}?formato=svg&ver=1`} alt={`QR de ${link}`} width={190} height={190} />
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#5b5f6b", fontFamily: "ui-monospace, Menlo, monospace", wordBreak: "break-all", textAlign: "center" }}>
                {host}/v/{initial.slug}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <a href={`${qr}?formato=png`} style={secondary}>
                Descargar PNG
              </a>
              <a href={`${qr}?formato=svg`} style={secondary}>
                Descargar SVG (imprenta)
              </a>
              <CopyLinkButton url={`${baseUrl.replace(/\/+$/, "")}/v/${initial.slug}`} style={secondary} />
            </div>
            <p style={hint}>Lleva sus propias etiquetas (utm), así cada venta sabe que vino del impreso.</p>
          </>
        ) : (
          <p style={{ ...hint, marginTop: 0 }}>Guarda la versión y aquí aparece su QR.</p>
        )}
      </div>
    </div>
  );
}
