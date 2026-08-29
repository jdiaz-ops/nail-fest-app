"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateInTz } from "@/lib/dateFormat";

type EventStatus = "DRAFT" | "PUBLISHED";

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  venueName: string | null;
  venueAddress: string | null;
  status: EventStatus;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  issued: number;
}

const STATUS_LABELS: Record<EventStatus, string> = { DRAFT: "Draft", PUBLISHED: "Published" };

export default function EventsTable({ events, timezone, language }: { events: EventRow[]; timezone: string; language: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [busyId, setBusyId] = useState<string | null>(null);

  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const upcoming: EventRow[] = [];
    const past: EventRow[] = [];
    for (const ev of events) {
      const endMs = new Date(ev.endsAt ?? ev.startsAt).getTime();
      (endMs >= now ? upcoming : past).push(ev);
    }
    // Soonest first for what's coming; most recent first for what already happened.
    upcoming.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    past.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    return { upcoming, past };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const rows = tab === "upcoming" ? upcoming : past;

  async function handleStatusChange(id: string, status: EventStatus) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, background: "#f6f5f2", borderRadius: 999, padding: 4 }}>
          <TabButton active={tab === "upcoming"} onClick={() => setTab("upcoming")}>
            Próximos ({upcoming.length})
          </TabButton>
          <TabButton active={tab === "past"} onClick={() => setTab("past")}>
            Pasados ({past.length})
          </TabButton>
        </div>
        <Link
          href="/admin/events/new"
          style={{
            padding: "10px 18px",
            borderRadius: 999,
            background: "#1c1310",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Agregar evento
        </Link>
      </div>

      <div className="admin-table-wrap">
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e3e1dc", color: "#5b5f6b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              <th style={{ padding: "8px 12px 8px 0" }}>Evento</th>
              <th style={{ padding: "8px 12px" }}>Estado</th>
              <th style={{ padding: "8px 12px" }}>Emitidas</th>
              <th style={{ padding: "8px 12px" }}>Restantes</th>
              <th style={{ padding: "8px 0" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((ev) => {
              const remaining = ev.capacity != null ? Math.max(0, ev.capacity - ev.issued) : null;
              const venue = [ev.venueName, ev.venueAddress].filter(Boolean).join(" — ");
              return (
                <tr key={ev.id} style={{ borderBottom: "1px solid #f0efec" }}>
                  <td style={{ padding: "14px 12px 14px 0" }}>
                    <Link href={`/admin/events/${ev.id}`} style={{ fontWeight: 600, color: "#1c1310", textDecoration: "none" }}>
                      {ev.name}
                    </Link>
                    <div style={{ fontSize: 13, color: "#5b5f6b", marginTop: 2 }}>
                      {venue || ev.city}
                      {venue ? ` — ${ev.city}` : ""}
                    </div>
                    <div style={{ fontSize: 13, color: "#5b5f6b" }}>
                      {formatDateInTz(new Date(ev.startsAt), { dateStyle: "medium", timeStyle: "short" }, timezone, language)}
                      {ev.endsAt
                        ? ` – ${formatDateInTz(new Date(ev.endsAt), { dateStyle: "medium", timeStyle: "short" }, timezone, language)}`
                        : ""}
                    </div>
                  </td>
                  <td style={{ padding: "14px 12px" }}>
                    <select
                      value={ev.status}
                      disabled={busyId === ev.id}
                      onChange={(e) => handleStatusChange(ev.id, e.target.value as EventStatus)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid " + (ev.status === "PUBLISHED" ? "#9fd8bd" : "#e3e1dc"),
                        background: ev.status === "PUBLISHED" ? "#e8f6ef" : "#f6f5f2",
                        color: ev.status === "PUBLISHED" ? "#0e6b4c" : "#5b5f6b",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "14px 12px", fontVariantNumeric: "tabular-nums" }}>{ev.issued.toLocaleString("es-CO")}</td>
                  <td style={{ padding: "14px 12px", fontVariantNumeric: "tabular-nums" }}>
                    {remaining === null ? "—" : remaining.toLocaleString("es-CO")}
                  </td>
                  <td style={{ padding: "14px 0", textAlign: "right" }}>
                    <a
                      href={`/${ev.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, color: "#5b5f6b" }}
                    >
                      Ver página ↗
                    </a>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "24px 0", color: "#5b5f6b" }}>
                  {tab === "upcoming" ? "No hay eventos próximos." : "No hay eventos pasados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 999,
        border: "none",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        background: active ? "#ffc5a8" : "transparent",
        color: active ? "#1c1310" : "#5b5f6b",
      }}
    >
      {children}
    </button>
  );
}
