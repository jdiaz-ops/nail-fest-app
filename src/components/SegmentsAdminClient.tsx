"use client";

import { useRef, useState } from "react";
import SegmentComposer, { type EditingSegment } from "./SegmentComposer";
import DeleteSegmentButton from "./DeleteSegmentButton";

// Same status-pill convention as everywhere else in the CRM — kept here
// (not imported from the server page) since this whole table now needs
// to be client-side to own which row is being edited.
const SYNC_STYLE: Record<string, { bg: string; ink: string; label: string }> = {
  PENDING: { bg: "#f6f5f2", ink: "#5b5f6b", label: "Pendiente" },
  OK: { bg: "#e8f6ef", ink: "#0e6b4c", label: "Sincronizado" },
  ERROR: { bg: "#fbe9ea", ink: "#a3212b", label: "Error" },
};

export interface SegmentRow {
  id: string;
  name: string;
  filter: unknown;
  memberCount: number;
  metaSync: { status: string; lastError: string | null; lastSyncedAt: Date | null } | null;
}

// Owns "which segment is being edited" — the composer above the table
// switches between its create form and an edit form for the chosen row;
// the server page (segments/page.tsx) stays a plain server component that
// just fetches data and hands it down.
export default function SegmentsAdminClient({
  events,
  professionOptions,
  cityOptions,
  segments,
}: {
  events: { slug: string; name: string }[];
  professionOptions: string[];
  cityOptions: string[];
  segments: SegmentRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const editingSegment: EditingSegment | null = editingId
    ? (() => {
        const s = segments.find((row) => row.id === editingId);
        return s ? { id: s.id, name: s.name, filter: s.filter } : null;
      })()
    : null;

  function startEdit(id: string) {
    setEditingId(id);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div ref={composerRef}>
        <SegmentComposer
          events={events}
          professionOptions={professionOptions}
          cityOptions={cityOptions}
          editingSegment={editingSegment}
          onDone={() => setEditingId(null)}
        />
      </div>

      <h2 style={{ fontSize: 16, marginTop: 40 }}>Segmentos guardados</h2>
      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Personas</th>
              <th style={{ padding: "10px 12px" }}>Sync con Meta</th>
              <th style={{ padding: "10px 12px" }}>Última sincronización</th>
              <th style={{ padding: "10px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => {
              const syncStyle = s.metaSync ? SYNC_STYLE[s.metaSync.status] : null;
              const isEditingThisRow = editingId === s.id;
              return (
                <tr
                  key={s.id}
                  style={{ borderTop: "1px solid #f0efec", background: isEditingThisRow ? "#f0faf8" : undefined }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: "10px 12px" }}>{s.memberCount}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {syncStyle ? (
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "4px 12px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: syncStyle.bg,
                          color: syncStyle.ink,
                        }}
                      >
                        {syncStyle.label}
                      </span>
                    ) : (
                      <span style={{ color: "#5b5f6b" }}>—</span>
                    )}
                    {s.metaSync?.lastError && (
                      <div style={{ color: "#a3212b", fontSize: 12, marginTop: 4 }}>{s.metaSync.lastError}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                    {s.metaSync?.lastSyncedAt ? new Date(s.metaSync.lastSyncedAt).toLocaleString("es-CO") : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => startEdit(s.id)}
                        disabled={isEditingThisRow}
                        style={{
                          background: "none",
                          border: "none",
                          color: isEditingThisRow ? "#8a8478" : "#0e6b4c",
                          cursor: isEditingThisRow ? "default" : "pointer",
                          fontSize: 13,
                          padding: 0,
                        }}
                      >
                        {isEditingThisRow ? "Editando…" : "Editar"}
                      </button>
                      <DeleteSegmentButton id={s.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {segments.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Aún no hay segmentos guardados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
