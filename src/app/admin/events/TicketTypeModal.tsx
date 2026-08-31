"use client";

import { useState } from "react";

type Status = "ON_SALE" | "HIDDEN" | "ACCESS_CODE_REQUIRED" | "SOLD_OUT" | "UNAVAILABLE" | "ADMIN_ONLY";
type Issuance = "INDIVIDUAL" | "GROUP";

// Literal English copy throughout this modal — same choice already made
// for CheckoutFormEditor.tsx's "Buyer question" modal: it mirrors Ticket
// Tailor's own admin UI text verbatim, field for field, per the actual
// screenshots this was built from.
const STATUS_LABELS: Record<Status, string> = {
  ON_SALE: "On sale",
  HIDDEN: "Hidden",
  ACCESS_CODE_REQUIRED: "Access code required",
  SOLD_OUT: "Display as Sold Out",
  UNAVAILABLE: "Display as Unavailable",
  ADMIN_ONLY: "Only visible to admin",
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
  excludeFromLowestPrice: boolean;
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
  excludeFromLowestPrice: false,
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
          Ticket name <span style={{ color: "#c2185b" }}>*</span>
        </label>
        <input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="General Admission" required />
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Ticket quantity</div>
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
            <span>Total quantity</span>
            <span style={{ fontWeight: 700 }}>{totalQuantity}</span>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Ticket price</div>
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
              Add booking fee
            </label>
            {values.hasBookingFee && (
              <div style={{ marginTop: 8 }}>
                <input type="number" min={0} value={values.bookingFee} onChange={(e) => set("bookingFee", e.target.value)} placeholder="Booking fee" />
              </div>
            )}
          </div>
          <div style={{ flex: 1, background: "#f6f5f2", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}>
            <div>Buyer will pay</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>${buyerPays.toLocaleString("es-CO")}</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#5b5f6b", fontSize: 13, cursor: "pointer", padding: 0 }}
      >
        {showAdvanced ? "▲ Hide advanced settings" : "▼ Show advanced settings"}
      </button>

      {showAdvanced && (
        <>
          <div className="field">
            <label>Description</label>
            <input value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="Enter any specific information for this ticket." />
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
                Min per order <span style={{ color: "#c2185b" }}>*</span>
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
                Max per order <span style={{ color: "#c2185b" }}>*</span>
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
              How would you like to issue tickets for this ticket type? <span style={{ color: "#c2185b" }}>*</span>
            </label>
            <select value={values.issuance} onChange={(e) => set("issuance", e.target.value as Issuance)}>
              <option value="INDIVIDUAL">Issue individual ticket QR codes for each ticket (e.g 5 tickets of this type = 5 barcodes)</option>
              <option value="GROUP">Issue a &quot;group ticket&quot; QR code for all tickets of this type (e.g 5 tickets of this type = 1 barcode)</option>
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={values.hasHideUntil} onChange={(e) => set("hasHideUntil", e.target.checked)} />
            Hide until a set date and time
          </label>
          {values.hasHideUntil && (
            <input type="datetime-local" value={values.hideUntil} onChange={(e) => set("hideUntil", e.target.value)} />
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={values.hasHideAfter} onChange={(e) => set("hasHideAfter", e.target.checked)} />
            Hide after a set date and time
          </label>
          {values.hasHideAfter && (
            <input type="datetime-local" value={values.hideAfter} onChange={(e) => set("hideAfter", e.target.value)} />
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={values.hideWhenSoldOut} onChange={(e) => set("hideWhenSoldOut", e.target.checked)} />
            Hide when sold out
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={values.showRemainingOnPage} onChange={(e) => set("showRemainingOnPage", e.target.checked)} />
            Show quantity remaining on event page
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={values.excludeFromLowestPrice} onChange={(e) => set("excludeFromLowestPrice", e.target.checked)} />
            Exclude from lowest price ticket calculation
          </label>
        </>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ padding: "8px 20px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !values.name.trim() || !values.quantity}
          onClick={() => onSave(values)}
          style={{ padding: "8px 20px", borderRadius: 999, border: "none", background: "#12966b", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          {isEdit ? "Save ticket type" : "Add ticket type"}
        </button>
      </div>
    </div>
  );
}
