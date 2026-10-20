"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminCuponeraBrand } from "@/lib/cuponera/admin";
import { formatPercent } from "@/lib/cuponera/shared";
import { api, BrandMark, CardTitle, cardStyle, cop, IconButton, Modal, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle, Switch } from "./ui";

const STORE_LABELS: Record<string, string> = {
  MARCOLINI: "Tienda en Marcolini",
  SHOPIFY: "Shopify",
  WOOCOMMERCE: "WooCommerce",
  OTHER: "Otra tienda",
};

// The brands that accepted Nail Fest in Marcolini: shown or hidden, their
// order on the page, and the text of their coupon card.
export default function CuponeraBrandsEditor({ brands }: { brands: AdminCuponeraBrand[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const available = brands.filter((b) => b.available);
  const gone = brands.filter((b) => !b.available);
  const editing = editingId ? brands.find((b) => b.id === editingId) ?? null : null;

  async function run(action: () => Promise<unknown>, failure: string) {
    setError(null);
    try {
      await action();
      router.refresh();
      return true;
    } catch {
      setError(failure);
      return false;
    }
  }

  async function move(id: string, direction: "up" | "down") {
    setBusy(true);
    await run(() => api(`/api/admin/cuponera/brands/${id}/move`, { method: "POST", body: JSON.stringify({ direction }) }), "No se pudo mover la marca.");
    setBusy(false);
  }

  async function toggle(id: string, visible: boolean) {
    setTogglingId(id);
    await run(() => api(`/api/admin/cuponera/brands/${id}`, { method: "PATCH", body: JSON.stringify({ visible }) }), "No se pudo cambiar la visibilidad.");
    setTogglingId(null);
  }

  async function saveCoupon(id: string, patch: { showCoupon: boolean; couponTitle: string; couponConditions: string[]; couponExclusive: boolean }) {
    setBusy(true);
    const ok = await run(() => api(`/api/admin/cuponera/brands/${id}`, { method: "PATCH", body: JSON.stringify(patch) }), "No se pudo guardar el cupón.");
    setBusy(false);
    if (ok) setEditingId(null);
  }

  return (
    <div style={cardStyle}>
      <CardTitle aside={<span style={mutedText}>{available.length === 1 ? "1 marca" : `${available.length} marcas`}</span>}>Marcas</CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Las que tienen a Nail Fest aceptada en Marcolini. Ocultar una marca saca de la cuponera su cupón y todos sus productos. El código, el
        descuento y la comisión los pone cada marca en Marcolini.
      </p>
      {error && <p style={{ color: "#b0225c", fontSize: 13 }}>{error}</p>}
      {brands.length === 0 && <p style={{ fontSize: 13, color: "#8a8478" }}>Todavía no hay marcas: sincroniza con Marcolini.</p>}

      {available.map((b, i) => (
        <div
          key={b.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 0",
            borderBottom: i < available.length - 1 ? "1px solid #f0efec" : "none",
            opacity: b.visible ? 1 : 0.5,
          }}
        >
          <BrandMark name={b.name} logoUrl={b.logoUrl} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 14 }}>{b.name}</b>
              {b.campaignName && <Pill tone="amber">Campaña: {b.campaignName}</Pill>}
              {!b.showCoupon && <Pill tone="grey">Sin cupón</Pill>}
            </span>
            <span style={{ display: "block", fontSize: 12, color: "#5b5f6b" }}>
              Código <b style={{ fontFamily: "ui-monospace, Menlo, monospace", color: "#17181c" }}>{b.discountCode}</b> · {formatPercent(b.discountPercent)} de descuento ·
              comisión {formatPercent(b.commissionPercent)}
            </span>
            <span style={{ display: "block", fontSize: 12, color: "#8a8478" }}>
              {STORE_LABELS[b.storeKind] ?? b.storeKind}
              {b.codeAppliedByLink ? " (el link aplica el código solo)" : " (la compradora escribe el código al pagar)"} ·{" "}
              {b.visibleProductCount === b.productCount ? `${b.productCount} productos` : `${b.visibleProductCount} de ${b.productCount} productos visibles`}
              {b.freeShippingFrom != null &&
                ` · envío gratis${b.freeShippingFrom > 0 ? ` desde ${cop(b.freeShippingFrom)}` : ""}${b.freeShippingAllZones ? "" : " en algunas zonas"}`}
              {b.storeUrl && (
                <>
                  {" · "}
                  <a href={b.storeUrl} target="_blank" rel="noreferrer">
                    tienda ↗
                  </a>
                </>
              )}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <IconButton title="Editar el cupón" onClick={() => setEditingId(b.id)} disabled={busy}>
              ✏️
            </IconButton>
            <IconButton title="Subir" onClick={() => move(b.id, "up")} disabled={busy || i === 0}>
              ↑
            </IconButton>
            <IconButton title="Bajar" onClick={() => move(b.id, "down")} disabled={busy || i === available.length - 1}>
              ↓
            </IconButton>
            <Switch
              checked={b.visible}
              disabled={togglingId === b.id}
              label={b.visible ? "Visible en la cuponera" : "Oculta de la cuponera"}
              onChange={(next) => toggle(b.id, next)}
            />
          </span>
        </div>
      ))}

      {gone.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#5b5f6b", marginBottom: 6 }}>Ya no están en Marcolini para Nail Fest</div>
          {gone.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", opacity: 0.55, fontSize: 13 }}>
              <BrandMark name={b.name} logoUrl={b.logoUrl} size={24} />
              <span>{b.name}</span>
              <span style={{ color: "#8a8478" }}>— sacó a Nail Fest o Marcolini la pausó; si vuelve, vuelve con lo que tenía.</span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={`Cupón de ${editing.name}`} onClose={() => setEditingId(null)}>
          <CouponForm brand={editing} busy={busy} onCancel={() => setEditingId(null)} onSave={(patch) => saveCoupon(editing.id, patch)} />
        </Modal>
      )}
    </div>
  );
}

function CouponForm({
  brand,
  busy,
  onCancel,
  onSave,
}: {
  brand: AdminCuponeraBrand;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: { showCoupon: boolean; couponTitle: string; couponConditions: string[]; couponExclusive: boolean }) => void;
}) {
  const [showCoupon, setShowCoupon] = useState(brand.showCoupon);
  const [title, setTitle] = useState(brand.couponTitle ?? "");
  const [conditions, setConditions] = useState(brand.couponConditions.join("\n"));
  const [exclusive, setExclusive] = useState(brand.couponExclusive);
  const defaultCondition = brand.codeAppliedByLink ? "Con el botón de la tienda el código se aplica solo" : "Escribe el código al pagar";
  const shippingCondition =
    brand.freeShippingFrom == null
      ? null
      : `Envío gratis${brand.freeShippingFrom > 0 ? ` desde ${cop(brand.freeShippingFrom)}` : ""}${brand.freeShippingAllZones ? "" : " en algunas zonas"}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
        <input type="checkbox" checked={showCoupon} onChange={(e) => setShowCoupon(e.target.checked)} />
        Mostrar su cupón en «Cupones de las marcas»
      </label>
      <div className="field">
        <label htmlFor="cup-coupon-title">Título del cupón</label>
        <input id="cup-coupon-title" value={title} maxLength={120} placeholder={`${formatPercent(brand.discountPercent)} de descuento`} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="cup-coupon-conds">Condiciones (una por línea)</label>
        <textarea
          id="cup-coupon-conds"
          rows={4}
          value={conditions}
          placeholder={[defaultCondition, shippingCondition ?? "Compra mínima $80.000"].join("\n")}
          onChange={(e) => setConditions(e.target.value)}
        />
        <span style={{ ...mutedText, fontSize: 12 }}>
          Vacío = «{defaultCondition}»{shippingCondition ? ` y «${shippingCondition}» (de sus zonas de envío en Marcolini)` : ""}. La tarjeta
          muestra las dos primeras; todas se ven al abrir el código. Escribe solo lo que la marca confirmó.
        </span>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 16 }}>
        <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} />
        Etiqueta «Exclusivo Nail Fest»
      </label>
      <p style={{ ...mutedText, fontSize: 12, marginTop: 0 }}>
        El código ({brand.discountCode}) y el descuento llegan de Marcolini; si cambian allá, cambian aquí en la siguiente sincronización.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onSave({
              showCoupon,
              couponTitle: title,
              couponConditions: conditions.split("\n").map((c) => c.trim()).filter(Boolean).slice(0, 8),
              couponExclusive: exclusive,
            })
          }
          style={primaryButtonStyle}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
