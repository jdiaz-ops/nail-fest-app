"use client";

import { useMemo, useState } from "react";
import { formatDateInTz } from "@/lib/dateFormat";

interface BuyerField {
  key: string;
  label: string;
  value: string;
  locked: boolean;
}

interface ScanEntry {
  scannedAt: string;
  result: string;
  scannerLabel: string | null;
}

export interface TicketRow {
  id: string;
  qrToken: string | null;
  status: "CONFIRMED" | "CANCELLED";
  createdAt: string;
  ticketTypeName: string | null;
  ticketCount: number;
  checkedInCount: number;
  buyerFields: BuyerField[];
  person: { firstName: string | null; lastName: string | null; email: string; phone: string | null; city: string | null; profession: string | null };
  scans: ScanEntry[];
  emailStatus: string | null;
  emailAt: string | null;
}

const SCAN_RESULT_LABEL: Record<string, string> = {
  VALID_FIRST: "Entrada válida",
  VALID_REENTRY: "Reingreso",
  WRONG_EVENT: "Boleto de otro evento",
  INVALID_TOKEN: "Código inválido",
  NOT_FOUND: "No existe",
};

const EMAIL_STATUS: Record<string, { label: string; bg: string; ink: string }> = {
  QUEUED: { label: "En cola", bg: "#f6f5f2", ink: "#5b5f6b" },
  SENT: { label: "Enviado", bg: "#f6f5f2", ink: "#5b5f6b" },
  DELIVERED: { label: "Entregado", bg: "#e6f9f7", ink: "#0b2e2c" },
  OPENED: { label: "Abierto", bg: "#e8f6ef", ink: "#0e6b4c" },
  CLICKED: { label: "Se hizo clic", bg: "#e8f6ef", ink: "#0e6b4c" },
  BOUNCED: { label: "Rebotó", bg: "#fbe9ea", ink: "#a3212b" },
  COMPLAINED: { label: "Marcado como spam", bg: "#fbe9ea", ink: "#a3212b" },
  FAILED: { label: "Falló el envío", bg: "#fbe9ea", ink: "#a3212b" },
};

function fullName(p: { firstName: string | null; lastName: string | null }) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "(sin nombre)";
}

export default function IssuedTicketsTable({
  eventId,
  rows: initialRows,
  timezone,
  language,
}: {
  eventId: string;
  rows: TicketRow[];
  timezone: string;
  language: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [ticketTypeFilter, setTicketTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "checked_in" | "not_checked_in" | "cancelled">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const ticketTypeNames = useMemo(() => Array.from(new Set(rows.map((r) => r.ticketTypeName).filter(Boolean))) as string[], [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (ticketTypeFilter && r.ticketTypeName !== ticketTypeFilter) return false;
      if (statusFilter === "cancelled" && r.status !== "CANCELLED") return false;
      if (statusFilter !== "cancelled" && r.status === "CANCELLED") return false;
      if (statusFilter === "checked_in" && r.checkedInCount === 0) return false;
      if (statusFilter === "not_checked_in" && r.checkedInCount > 0) return false;
      if (!q) return true;
      return (
        fullName(r.person).toLowerCase().includes(q) ||
        r.person.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.qrToken ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, ticketTypeFilter, statusFilter]);

  const openRow = rows.find((r) => r.id === openId) ?? null;

  function updateRow(id: string, patch: Partial<TicketRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Entradas emitidas ({filtered.length})</h2>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, correo, id u orden…"
          style={{ flex: "1 1 260px", padding: "8px 10px" }}
        />
        <select value={ticketTypeFilter} onChange={(e) => setTicketTypeFilter(e.target.value)} style={{ padding: "8px 10px" }}>
          <option value="">Todos los tipos de entrada</option>
          {ticketTypeNames.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={{ padding: "8px 10px" }}>
          <option value="all">Todas (activas)</option>
          <option value="checked_in">Ya entraron</option>
          <option value="not_checked_in">Aún no entran</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>

      <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "8px 12px" }}>Nombre</th>
              <th style={{ padding: "8px 12px" }}>Tipo de entrada</th>
              <th style={{ padding: "8px 12px" }}>Emitida</th>
              <th style={{ padding: "8px 12px" }}>Check-in</th>
              <th style={{ padding: "8px 12px" }}>Correo</th>
              <th style={{ padding: "8px 12px" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const emailBadge = r.emailStatus ? EMAIL_STATUS[r.emailStatus] : null;
              return (
                <tr
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  style={{ borderTop: "1px solid #f0efec", cursor: "pointer" }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 600 }}>{fullName(r.person)}</div>
                    <div style={{ color: "#5b5f6b", fontSize: 12 }}>{r.person.email}</div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{r.ticketTypeName ?? "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                    {formatDateInTz(new Date(r.createdAt), { dateStyle: "medium" }, timezone, language)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.checkedInCount} / {r.ticketCount}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {emailBadge ? (
                      <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: emailBadge.bg, color: emailBadge.ink }}>
                        {emailBadge.label}
                      </span>
                    ) : (
                      <span style={{ color: "#8a8478", fontSize: 12 }}>Sin envíos</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.status === "CANCELLED" ? (
                      <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#fbe9ea", color: "#a3212b" }}>
                        Cancelada
                      </span>
                    ) : (
                      <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#e8f6ef", color: "#0e6b4c" }}>
                        Activa
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  {rows.length === 0 ? "Aún no hay entradas emitidas para este evento." : "Nadie coincide con esa búsqueda/filtro."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openRow && (
        <TicketModal
          eventId={eventId}
          row={openRow}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => updateRow(openRow.id, patch)}
          timezone={timezone}
          language={language}
        />
      )}
    </div>
  );
}

function TicketModal({
  row,
  onClose,
  onUpdate,
  timezone,
  language,
}: {
  eventId: string;
  row: TicketRow;
  onClose: () => void;
  onUpdate: (patch: Partial<TicketRow>) => void;
  timezone: string;
  language: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => Object.fromEntries(row.buyerFields.map((f) => [f.key, f.value])));
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const emailBadge = row.emailStatus ? EMAIL_STATUS[row.emailStatus] : null;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    // NOT f.locked — "locked" only means an admin can't delete/reorder the
    // question (see CheckoutQuestion.locked), it does NOT mean the answer
    // lives on a Person column. cedula is locked=true but its answer lives
    // in Registration.customFields, same as any unlocked custom question
    // (see registrationDetails.ts's buildBuyerFields, which reads it via
    // the same `default:` branch as a real custom field) — splitting on
    // `locked` here silently dropped cédula edits into neither bucket.
    const personBacked = new Set(["fullName", "email", "phone", "city", "profession"]);
    const locked = Object.fromEntries(row.buyerFields.filter((f) => personBacked.has(f.key)).map((f) => [f.key, draft[f.key]]));
    const custom = Object.fromEntries(row.buyerFields.filter((f) => !personBacked.has(f.key)).map((f) => [f.key, draft[f.key]]));
    const [firstName, ...rest] = (locked.fullName ?? "").split(" ");
    const body: Record<string, unknown> = {
      firstName: firstName || undefined,
      lastName: rest.join(" ") || "",
      email: locked.email || undefined,
      phone: locked.phone || undefined,
      city: locked.city ?? "",
      profession: locked.profession ?? "",
      customFields: custom,
    };
    const res = await fetch(`/api/admin/registrations/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resBody = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      onUpdate({ buyerFields: row.buyerFields.map((f) => ({ ...f, value: draft[f.key] ?? f.value })) });
      setEditing(false);
      setMessage("Guardado.");
    } else {
      setMessage(resBody.message || "No se pudo guardar — revisa los datos.");
    }
  }

  async function handleResend() {
    setResending(true);
    setMessage(null);
    const res = await fetch(`/api/admin/registrations/${row.id}/resend`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setResending(false);
    setMessage(res.ok && body.ok ? "Correo reenviado." : "No se pudo reenviar el correo.");
  }

  async function handleToggleStatus() {
    const next = row.status === "CANCELLED" ? "CONFIRMED" : "CANCELLED";
    const verb = next === "CANCELLED" ? "cancelar" : "reactivar";
    if (!confirm(`¿Seguro que quieres ${verb} esta inscripción?`)) return;
    setToggling(true);
    const res = await fetch(`/api/admin/registrations/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setToggling(false);
    if (res.ok) {
      onUpdate({ status: next });
      setMessage(next === "CANCELLED" ? "Inscripción cancelada." : "Inscripción reactivada.");
    } else {
      setMessage("No se pudo actualizar el estado.");
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,28,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 50, overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 560, width: "100%", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{fullName(row.person)}</h2>
            <div style={{ fontSize: 12, color: "#5b5f6b" }}>
              Orden {row.id.slice(-8).toUpperCase()} {row.qrToken ? `· Código ${row.qrToken.slice(0, 8)}` : ""}
            </div>
          </div>
          <button type="button" onClick={onClose} className="secondary" style={{ padding: "4px 10px" }}>
            Cerrar
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
          <button type="button" className="primary" disabled={resending} onClick={handleResend} style={{ padding: "8px 14px", fontSize: 13 }}>
            {resending ? "Enviando…" : "Reenviar correo"}
          </button>
          <button type="button" className="secondary" onClick={() => setEditing((v) => !v)} style={{ padding: "8px 14px", fontSize: 13 }}>
            {editing ? "Cancelar edición" : "Editar detalles"}
          </button>
          <button type="button" className="secondary" disabled={toggling} onClick={handleToggleStatus} style={{ padding: "8px 14px", fontSize: 13, color: row.status === "CANCELLED" ? undefined : "#a3212b" }}>
            {row.status === "CANCELLED" ? "Reactivar inscripción" : "Cancelar inscripción"}
          </button>
        </div>

        {message && <p style={{ fontSize: 13, color: "#0e6b4c" }}>{message}</p>}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
            Estado del correo de confirmación
          </div>
          {emailBadge ? (
            <div>
              <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: emailBadge.bg, color: emailBadge.ink }}>
                {emailBadge.label}
              </span>
              {row.emailAt && (
                <span style={{ fontSize: 12, color: "#5b5f6b", marginLeft: 8 }}>
                  {formatDateInTz(new Date(row.emailAt), { dateStyle: "medium", timeStyle: "short" }, timezone, language)}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: "#5b5f6b" }}>Nunca se le ha enviado un correo de confirmación.</span>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Entrada</div>
          <p style={{ margin: 0, fontSize: 13 }}>
            {row.ticketTypeName ?? "Entrada general"} — {row.checkedInCount} de {row.ticketCount} {row.ticketCount === 1 ? "escaneada" : "escaneadas"}
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            Datos del comprador
          </div>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {row.buyerFields.map((f) => (
                <div className="field" key={f.key} style={{ margin: 0 }}>
                  <label style={{ fontSize: 12 }}>{f.label}</label>
                  <input value={draft[f.key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} style={{ fontSize: 13 }} />
                </div>
              ))}
              <button type="button" className="primary" disabled={saving} onClick={handleSave} style={{ padding: "8px 14px", fontSize: 13, alignSelf: "flex-start" }}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                {row.buyerFields.map((f) => (
                  <tr key={f.key}>
                    <td style={{ padding: "3px 8px 3px 0", color: "#5b5f6b", whiteSpace: "nowrap", verticalAlign: "top" }}>{f.label}</td>
                    <td style={{ padding: "3px 0" }}>{f.value || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            Historial de check-in
          </div>
          {row.scans.length === 0 ? (
            <p style={{ fontSize: 13, color: "#5b5f6b", margin: 0 }}>Sin historial de escaneo.</p>
          ) : (
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                {row.scans.map((s, i) => (
                  <tr key={i}>
                    <td style={{ padding: "3px 8px 3px 0", color: "#5b5f6b", whiteSpace: "nowrap" }}>
                      {formatDateInTz(new Date(s.scannedAt), { dateStyle: "medium", timeStyle: "short" }, timezone, language)}
                    </td>
                    <td style={{ padding: "3px 0" }}>{SCAN_RESULT_LABEL[s.result] ?? s.result}</td>
                    <td style={{ padding: "3px 0 3px 8px", color: "#5b5f6b" }}>{s.scannerLabel ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
