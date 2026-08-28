"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TicketTypeModal, { type TicketTypeValues, EMPTY_TICKET_TYPE } from "./TicketTypeModal";

export interface TicketTypeRow {
  id: string;
  name: string;
  quantity: number;
  price: number;
  bookingFee: number;
  description: string;
  status: string;
  minPerOrder: number;
  maxPerOrder: number;
  issuance: string;
  hideUntil: string | null;
  hideAfter: string | null;
  hideWhenSoldOut: boolean;
  showRemainingOnPage: boolean;
  excludeFromLowestPrice: boolean;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  ON_SALE: { label: "On sale", bg: "#e8f6ef", fg: "#0e6b4c" },
  HIDDEN: { label: "Hidden", bg: "#f6f5f2", fg: "#5b5f6b" },
  ACCESS_CODE_REQUIRED: { label: "Access code required", bg: "#fdf1e6", fg: "#8a5a1f" },
  SOLD_OUT: { label: "Sold Out", bg: "#fbe9ea", fg: "#a3212b" },
  UNAVAILABLE: { label: "Unavailable", bg: "#fbe9ea", fg: "#a3212b" },
  ADMIN_ONLY: { label: "Only visible to admin", bg: "#f6f5f2", fg: "#5b5f6b" },
};

function toModalValues(t?: TicketTypeRow): TicketTypeValues {
  if (!t) return EMPTY_TICKET_TYPE;
  return {
    id: t.id,
    name: t.name,
    quantity: String(t.quantity),
    price: String(t.price),
    hasBookingFee: t.bookingFee > 0,
    bookingFee: String(t.bookingFee),
    description: t.description,
    status: t.status as TicketTypeValues["status"],
    minPerOrder: t.minPerOrder,
    maxPerOrder: t.maxPerOrder,
    issuance: t.issuance as TicketTypeValues["issuance"],
    hasHideUntil: Boolean(t.hideUntil),
    hideUntil: t.hideUntil ? t.hideUntil.slice(0, 16) : "",
    hasHideAfter: Boolean(t.hideAfter),
    hideAfter: t.hideAfter ? t.hideAfter.slice(0, 16) : "",
    hideWhenSoldOut: t.hideWhenSoldOut,
    showRemainingOnPage: t.showRemainingOnPage,
    excludeFromLowestPrice: t.excludeFromLowestPrice,
  };
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "request_failed");
  }
  return res.json().catch(() => ({}));
}

export default function TicketTypesSection({ eventId, initialTicketTypes }: { eventId: string; initialTicketTypes: TicketTypeRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = editingId ? initialTicketTypes.find((t) => t.id === editingId) : undefined;

  function toBody(v: TicketTypeValues) {
    return {
      name: v.name.trim(),
      quantity: Number(v.quantity),
      price: Number(v.price) || 0,
      bookingFee: v.hasBookingFee ? Number(v.bookingFee) || 0 : 0,
      description: v.description.trim(),
      status: v.status,
      minPerOrder: v.minPerOrder,
      maxPerOrder: v.maxPerOrder,
      issuance: v.issuance,
      hideUntil: v.hasHideUntil && v.hideUntil ? new Date(v.hideUntil).toISOString() : null,
      hideAfter: v.hasHideAfter && v.hideAfter ? new Date(v.hideAfter).toISOString() : null,
      hideWhenSoldOut: v.hideWhenSoldOut,
      showRemainingOnPage: v.showRemainingOnPage,
      excludeFromLowestPrice: v.excludeFromLowestPrice,
    };
  }

  async function handleCreate(v: TicketTypeValues) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/events/${eventId}/ticket-types`, { method: "POST", body: JSON.stringify(toBody(v)) });
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message === "min_greater_than_max" ? "Min per order no puede ser mayor que Max per order." : "No se pudo crear el tipo de boleta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(v: TicketTypeValues) {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/events/${eventId}/ticket-types/${editingId}`, { method: "PATCH", body: JSON.stringify(toBody(v)) });
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message === "min_greater_than_max" ? "Min per order no puede ser mayor que Max per order." : "No se pudo guardar el tipo de boleta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar este tipo de boleta?")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/events/${eventId}/ticket-types/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setError("No se pudo borrar el tipo de boleta.");
    } finally {
      setBusy(false);
    }
  }

  const otherTypesQuantity = (excludeId?: string) =>
    initialTicketTypes.filter((t) => t.id !== excludeId).reduce((sum, t) => sum + t.quantity, 0);

  return (
    <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontWeight: 600 }}>Tickets and items</div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: "#1c1310", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          Add ticket type
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 0, marginBottom: 16 }}>
        Todos los eventos de Nail Fest son gratuitos hoy — el precio siempre queda en $0, pero el
        tipo de boleta en sí es real (cantidad, estado, límites por orden, etc.), listo para el día
        que se conecte un método de pago.
      </p>

      {error && <p style={{ color: "#c2185b", fontSize: 13 }}>{error}</p>}

      {initialTicketTypes.length === 0 && (
        <div style={{ border: "1px dashed #e3e1dc", borderRadius: 8, padding: 24, textAlign: "center", color: "#5b5f6b", fontSize: 14 }}>
          Add a ticket type
          <div style={{ fontSize: 12, marginTop: 4 }}>You must create at least one ticket type</div>
        </div>
      )}

      {initialTicketTypes.map((t, i) => {
        const badge = STATUS_BADGE[t.status] ?? { label: t.status, bg: "#f6f5f2", fg: "#5b5f6b" };
        return (
          <div
            key={t.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              fontSize: 14,
              borderBottom: i < initialTicketTypes.length - 1 ? "1px solid #f0efec" : "none",
            }}
          >
            <span>
              <span style={{ fontWeight: 600 }}>{t.name}</span>{" "}
              <span style={{ color: "#5b5f6b" }}>· {t.quantity} · ${t.price.toLocaleString("es-CO")}</span>{" "}
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: badge.bg, color: badge.fg, marginLeft: 4 }}>
                {badge.label}
              </span>
            </span>
            <span style={{ display: "flex", gap: 4 }}>
              <button type="button" title="Editar" onClick={() => setEditingId(t.id)} disabled={busy} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14, padding: 4 }}>
                ✏️
              </button>
              <button type="button" title="Borrar" onClick={() => handleDelete(t.id)} disabled={busy} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14, padding: 4 }}>
                🗑️
              </button>
            </span>
          </div>
        );
      })}

      {adding && (
        <Modal title="Add a new ticket type" onClose={() => setAdding(false)}>
          <TicketTypeModal
            initial={EMPTY_TICKET_TYPE}
            otherTypesQuantity={otherTypesQuantity()}
            busy={busy}
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit ticket type" onClose={() => setEditingId(null)}>
          <TicketTypeModal
            initial={toModalValues(editing)}
            otherTypesQuantity={otherTypesQuantity(editing.id)}
            busy={busy}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,19,16,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#5b5f6b" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
