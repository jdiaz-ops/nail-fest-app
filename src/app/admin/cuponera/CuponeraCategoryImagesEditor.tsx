"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductIcon from "@/components/cuponera/ProductIcon";
import { CATEGORY_ART } from "@/components/cuponera/categoryArt";
import { CUPONERA_CATEGORIES, type CuponeraCategory } from "@/lib/cuponera/shared";
import { api, CardTitle, cardStyle, mutedText, secondaryButtonStyle } from "./ui";

const CATEGORIES = CUPONERA_CATEGORIES.filter((c) => c.key !== "todo") as { key: CuponeraCategory; label: string; chip: string }[];

// The pictures of "Descubre por categoría", the tiles under the search on
// the front page. Without one, a category shows its drawing; a category
// with no products doesn't show at all.
export default function CuponeraCategoryImagesEditor({ images, counts }: { images: Record<string, string>; counts: Record<string, number> }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(next: Record<string, string>, key: string) {
    await api("/api/admin/cuponera/settings", { method: "PATCH", body: JSON.stringify({ categoryImages: next }) });
    router.refresh();
    setBusyKey((k) => (k === key ? null : k));
  }

  async function upload(key: CuponeraCategory, file: File) {
    setBusyKey(key);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/uploads/cuponera-image", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body?.url !== "string") {
        setError(
          body?.error === "too_large"
            ? "La imagen pesa más de 5 MB."
            : body?.error === "blob_not_configured"
              ? "El almacenamiento de imágenes no está configurado."
              : "No se pudo subir la imagen.",
        );
        setBusyKey(null);
        return;
      }
      await save({ ...images, [key]: body.url }, key);
    } catch {
      setError("No se pudo subir la imagen.");
      setBusyKey(null);
    }
  }

  async function remove(key: CuponeraCategory) {
    setBusyKey(key);
    setError(null);
    try {
      const next = { ...images };
      delete next[key];
      await save(next, key);
    } catch {
      setError("No se pudo quitar la imagen.");
      setBusyKey(null);
    }
  }

  return (
    <div style={cardStyle}>
      <CardTitle>Categorías de la portada</CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Los cuadros de «Descubre por categoría», debajo de la búsqueda; cada uno abre la colección con los productos de todas las marcas. Sube
        una imagen cuadrada por categoría (el nombre se pone encima, abajo a la izquierda); sin imagen se ve el dibujo. Las categorías sin
        productos no salen.
      </p>
      {error && <p style={{ color: "#b0225c", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
        {CATEGORIES.map((c) => {
          const image = images[c.key];
          const art = CATEGORY_ART[c.key];
          const count = counts[c.key] ?? 0;
          const busy = busyKey === c.key;
          return (
            <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 6, opacity: count > 0 ? 1 : 0.55 }}>
              <div
                style={{
                  position: "relative",
                  aspectRatio: "1 / 1",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: art.background,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded picture
                  <img src={image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <ProductIcon kind={art.icon} color={art.color} size={48} />
                )}
              </div>
              <b style={{ fontSize: 13 }}>{c.chip}</b>
              <span style={{ fontSize: 12, color: "#8a8478" }}>{count === 0 ? "Sin productos: no sale" : count === 1 ? "1 producto" : `${count} productos`}</span>
              <label style={{ ...secondaryButtonStyle, padding: "5px 10px", fontSize: 12, textAlign: "center", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Guardando…" : image ? "Cambiar imagen" : "Subir imagen"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={busyKey !== null}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void upload(c.key, file);
                  }}
                />
              </label>
              {image && (
                <button type="button" style={{ border: "none", background: "none", color: "#5b5f6b", fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: 0 }} disabled={busyKey !== null} onClick={() => remove(c.key)}>
                  Quitar imagen
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
