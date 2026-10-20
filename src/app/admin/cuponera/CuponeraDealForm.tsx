"use client";

import { useState } from "react";
import { api, CardTitle, cardStyle, mutedText, primaryButtonStyle } from "./ui";

// The end date is always Bogotá time (UTC−5, no DST), so the server and the
// browser render the same value whatever timezone each one runs in.
const BOGOTA_OFFSET_MS = 5 * 3_600_000;

function toBogotaInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 16);
}

function fromBogotaInput(value: string): string {
  return new Date(`${value}:00-05:00`).toISOString();
}

// Robo del día: automatic (a different featured product every day) or a
// product the admin pins, until a date or until changed.
export default function CuponeraDealForm({
  initialProductId,
  initialEndsAt,
  options,
  todayName,
  sectionOn,
}: {
  initialProductId: string | null;
  initialEndsAt: string | null;
  options: { id: string; label: string }[];
  todayName: string | null;
  sectionOn: boolean;
}) {
  const [mode, setMode] = useState<"auto" | "pinned">(initialProductId ? "pinned" : "auto");
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [endsAt, setEndsAt] = useState(toBogotaInput(initialEndsAt));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "missing">("idle");

  async function save() {
    if (mode === "pinned" && !productId) {
      setStatus("missing");
      return;
    }
    setStatus("saving");
    try {
      await api("/api/admin/cuponera/settings", {
        method: "PATCH",
        body: JSON.stringify(
          mode === "auto"
            ? { dealProductId: null, dealEndsAt: null }
            : { dealProductId: productId, dealEndsAt: endsAt ? fromBogotaInput(endsAt) : null },
        ),
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const radio = (value: "auto" | "pinned", label: string, hint: string) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 10 }}>
      <input
        type="radio"
        name="cup-deal-mode"
        checked={mode === value}
        onChange={() => {
          setMode(value);
          setStatus("idle");
        }}
        style={{ marginTop: 3 }}
      />
      <span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        <span style={{ display: "block", ...mutedText, fontSize: 12 }}>{hint}</span>
      </span>
    </label>
  );

  return (
    <div style={cardStyle}>
      <CardTitle>Robo del día</CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        {!sectionOn
          ? "La sección está apagada (Textos y secciones)."
          : todayName
            ? `Hoy se ve: ${todayName}.`
            : "Hoy no hay ninguno: marca productos como destacados (★) o elige uno."}
      </p>

      {radio("auto", "Automático", "Cambia cada día a medianoche entre los productos destacados (★); si no hay destacados, entre todos los que tienen descuento.")}
      {radio("pinned", "Elegir un producto", "Se queda hasta la fecha que pongas, o hasta que lo cambies (sin fecha no se muestra cuenta regresiva).")}

      {mode === "pinned" && (
        <div style={{ borderLeft: "3px solid #e6f9f7", paddingLeft: 14, marginTop: 6 }}>
          <div className="field">
            <label htmlFor="cup-deal-product">Producto</label>
            <select
              id="cup-deal-product"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setStatus("idle");
              }}
            >
              <option value="">Elige un producto…</option>
              {productId && !options.some((o) => o.id === productId) && <option value={productId}>(El producto elegido ya no está visible)</option>}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="cup-deal-ends">Hasta (opcional, hora de Colombia)</label>
            <input
              id="cup-deal-ends"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => {
                setEndsAt(e.target.value);
                setStatus("idle");
              }}
            />
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={save} disabled={status === "saving"} style={primaryButtonStyle}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        {status === "saved" && <span style={{ color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "missing" && <span style={{ color: "#b0225c", fontSize: 14 }}>Elige el producto.</span>}
        {status === "error" && <span style={{ color: "#b0225c", fontSize: 14 }}>No se pudo guardar. Vuelve a intentarlo.</span>}
      </div>
    </div>
  );
}
