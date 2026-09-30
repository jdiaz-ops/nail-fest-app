"use client";

import { useState } from "react";

type Status = "ON_SALE" | "HIDDEN" | "ACCESS_CODE_REQUIRED" | "SOLD_OUT" | "UNAVAILABLE" | "ADMIN_ONLY";
type Issuance = "INDIVIDUAL" | "GROUP";

// Literal English copy throughout this modal — same choice already made
// for CheckoutFormEditor.tsx's "Buyer question" modal: it mirrors our
// previous ticketing platform's own admin UI text verbatim, field for field, per the actual
// screenshots this was built from.
const STATUS_LABELS: Record<Status, string> = {
  ON_SALE: "A la venta",
  HIDDEN: "Oculta",
  ACCESS_CODE_REQUIRED: "Requiere código de acceso",
  SOLD_OUT: "Mostrar como agotada",
  UNAVAILABLE: "Mostrar como no disponible",
  ADMIN_ONLY: "Solo visible para admin",
};

const PER_ORDER_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export interface TicketTypeValues {
  id?: string;
  name: string;
  quantity: string;
  price: string;
  hasBookingFee: boolean;
  bookingFee: string;
  description: string;
  status: Status;
  minPerOrder: number;
  maxPerOrder: number;
  issuance: Issuance;
  hasHideUntil: boolean;
  hideUntil: string;
  hasHideAfter: boolean;
  hideAfter: string;
  hideWhenSoldOut: boolean;
  showRemainingOnPage: boolean;
}

export const EMPTY_TICKET_TYPE: TicketTypeValues = {
  name: "",
  quantity: "",
  price: "0",
  hasBookingFee: false,
  bookingFee: "0",
  description: "",
  status: "ON_SALE",
  minPerOrder: 1,
  maxPerOrder: 20,
  issuance: "INDIVIDUAL",
  hasHideUntil: false,
  hideUntil: "",
  hasHideAfter: false,
  hideAfter: "",
  hideWhenSoldOut: false,
  showRemainingOnPage: false,
};

export default function TicketTypeModal({
  initial,
  otherTypesQuantity,
  busy,
  onSave,
  onCancel,
}: {
  initial: TicketTypeValues;
  // Sum of every OTHER ticket type's quantity for this event — "Total
  // quantity" below is that plus whatever's typed here, live, matching
  // our previous ticketing platform's own running total. Deliberately NOT written back to
  // Event.capacity (see the schema's own comment on TicketType) — purely
  // informational here.
  otherTypesQuantity: number;
  busy: boolean;
  onSave: (values: TicketTypeValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(initial.id));
  const isEdit = Boolean(initial.id);

  function set<K extends keyof TicketTypeValues>(key: K, v: TicketTypeValues[K]) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  const quantityNum = Number(values.quantity) || 0;
  const totalQuantity = otherTypesQuantity + quantityNum;
  const priceNum = Number(values.price) || 0;
  const bookingFeeNum = values.hasBookingFee ? Number(values.bookingFee) || 0 : 0;
  const buyerPays = priceNum + bookingFeeNum;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label>
          Nombre de la entrada <span style={{ color: "#c2185b" }}>*</span>
        </label>
        <input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="General Admission" required />
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Cantidad de entradas</div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>
              Quantity <span style={{ color: "#c2185b" }}>*</span>
            </label>
            <input type="number" min={1} value={values.quantity} onChange={(e) => set("quantity", e.target.value)} required />
          </div>
          <div
            style={{
              flex: 1,
              background: "#f6f5f2",
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 14,
            }}
          >
            <span>Cantidad total</span>
            <span style={{ fontWeight: 700 }}>{totalQuantity}</span>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Precio</div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <div style={{ display: "flex" }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 10px",
                  border: "1px solid var(--border, #e3e1dc)",
                  borderRight: "none",
                  borderRadius: "8px 0 0 8px",
                  background: "#f6f5f2",
                }}
              >
                $
              </span>
              <input
                type="number"
                min={0}
                value={values.price}
                onChange={(e) => set("price", e.target.value)}
                style={{ borderRadius: "0 8px 8px 0" }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 8 }}>
              <input type="checkbox" checked={values.hasBookingFee} onChange={(e) => set("hasBookingFee", e.target.checked)} />
              Agregar cargo por servicio
            </label>
            {values.hasBookingFee && (
              <div style={{ marginTop: 8 }}>
                <input type="number" min={0} value={values.bookingFee} onChange={(e) => set("bookingFee", e.target.value)} placeholder="Cargo por servicio" />
              </div>
            )}
          </div>
          <div style={{ flex: 1, background: "#f6f5f2", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}>
            <div>El comprador paga</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>${buyerPays.toLocaleString("es-CO")}</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#5b5f6b", fontSize: 13, cursor: "pointer", padding: 0 }}
      >
        {showAdvanced ? "▲ Ocultar opciones avanzadas" : "▼ Mostrar opciones avanzadas"}
      </button>

      {showAdvanced && (
        <>
          <div className="field">
            <label>Descripción</label>
            <input value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="Información específica de esta entrada (opcional)" />
          </div>

          <div className="field">
            <label>
              Status <span style={{ color: "#c2185b" }}>*</span>
            </label>
            <select value={values.status} onChange={(e) => set("status", e.target.value as Status)}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field">
              <label>
                Mínimo por pedido <span style={{ color: "#c2185b" }}>*</span>
              </label>
              <select value={values.minPerOrder} onChange={(e) => set("minPerOrder", Number(e.target.value))}>
                {PER_ORDER_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>
                Máximo por pedido <span style={{ color: "#c2185b" }}>*</span>
              </label>
              <select value={values.maxPerOrder} onChange={(e) => set("maxPerOrder", Number(e.target.value))}>
                {PER_ORDER_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>
              ¿Cómo se emiten las entradas de este tipo? <span style={{ color: "#c2185b" }}>*</span>
            </label>
            <select value={values.issuance} onChange={(e) => set("issuance", e.target.value as Issuance)}>
              <option value="INDIVIDUAL">Un QR por cada entrada (ej. 5 entradas = 5 códigos QR)</option>
              <option value="GROUP">Un solo QR de grupo para todas (ej. 5 entradas = 1 código QR)</option>
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={values.hasHideUntil} onChange={(e) => set("hasHideUntil", e.target.checked)} />
            Ocultar hasta una fecha y hora
          </label>
          {values.hasHideUntil && (
            <input type="datetime-local" value={values.hideUntil} onChange={(e) => set("hideUntil", e.target.value)} />
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={values.hasHideAfter} onChange={(e) => set("hasHideAfter", e.target.checked)} />
            Ocultar después de una fecha y hora
          </label>
          {values.hasHideAfter && (
            <input type="datetime-local" value={values.hideAfter} onChange={(e) => set("hideAfter", e.target.value)} />
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={values.hideWhenSoldOut} onChange={(e) => set("hideWhenSoldOut", e.target.checked)} />
            Ocultar cuando se agote
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={values.showRemainingOnPage} onChange={(e) => set("showRemainingOnPage", e.target.checked)} />
            Mostrar cuántas quedan en la página del evento
          </label>
          {/* "Exclude from lowest price ticket calculation" removed — there
              was never a "lowest price" display anywhere in the app for it
              to exclude anything FROM, so the checkbox did nothing
              regardless of how it was set. Build the real feature first if
              this comes back. */}
        </>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ padding: "8px 20px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", fontSize: 13, cursor: "pointer" }}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !values.name.trim() || !values.quantity}
          onClick={() => onSave(values)}
          style={{ padding: "8px 20px", borderRadius: 999, border: "none", background: "#12966b", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          {isEdit ? "Guardar entrada" : "Agregar entrada"}
        </button>
      </div>
    </div>
  );
}
