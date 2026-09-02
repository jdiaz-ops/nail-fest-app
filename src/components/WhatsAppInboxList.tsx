"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Filter = "all" | "unread" | "mine";

type ConversationRow = {
  id: string;
  phone: string;
  name: string | null;
  assignedToLabel: string | null;
  unreadCount: number;
  withinWindow: boolean;
  lastMessage: { body: string | null; direction: "INBOUND" | "OUTBOUND"; createdAt: string } | null;
  lastActivityAt: string;
};

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "unread", label: "No leídos" },
  { key: "mine", label: "Asignados a mí" },
];

const AVATAR_COLORS = ["#00beb5", "#ffc5a8", "#7c6ee8", "#e88a4f", "#4f9de8", "#e85f8a"];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

function initials(name: string | null, phone: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
    if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  return phone.replace(/\D/g, "").slice(-2) || "?";
}

// The persistent left pane of the Bandeja split view (see
// bandeja/layout.tsx) — a client component, not a server-rendered list
// like the old bandeja/page.tsx, for two reasons: it has to survive
// switching between /bandeja/[id] routes without remounting (that's the
// whole point of the redesign — WhatsApp/WhatChimp never lose the list
// from view), and it has to stay reasonably live (poll + an explicit
// refresh event) since new inbound messages don't push anything to the
// browser here. Fires a "whatsapp-inbox-refresh" window event on demand
// (dispatched by WhatsAppMarkRead and the thread composer) so opening or
// replying to a conversation updates the list immediately instead of
// waiting for the next poll.
//
// basePath — where a row's link goes. Defaults to the desktop CRM route;
// the mobile scan-app Bandeja (/admin/scan/[eventId]/bandeja, ADMIN and
// COORDINADOR only, so staff working the door can reply during an event)
// reuses this exact component with its own basePath instead of a forked
// copy of the list rendering. activeId's own regex just looks for
// "/bandeja/<id>" anywhere in the path, so it already works under either
// base without changes.
export default function WhatsAppInboxList({ basePath = "/admin/crm/whatsapp/bandeja" }: { basePath?: string } = {}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const pathname = usePathname();
  const activeId = pathname?.match(/\/bandeja\/([^/]+)/)?.[1] ?? null;
  const inFlight = useRef(false);

  const load = useCallback(async (f: Filter) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations?filter=${f}`, { cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        setRows(body.conversations);
      }
    } catch {
      // Best-effort — keep whatever was last shown rather than blanking
      // the list over a transient network hiccup.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load(filter);
    const poll = setInterval(() => load(filter), 12000);
    const onRefresh = () => load(filter);
    window.addEventListener("whatsapp-inbox-refresh", onRefresh);
    return () => {
      clearInterval(poll);
      window.removeEventListener("whatsapp-inbox-refresh", onRefresh);
    };
  }, [filter, load]);

  // Instant local feedback the moment a thread is opened — matches
  // WhatChimp's own behavior of clearing the unread badge the moment you
  // click into a conversation, without waiting on the network round trip
  // that WhatsAppMarkRead's POST (and the resulting refresh event) takes.
  useEffect(() => {
    if (!activeId) return;
    setRows((prev) => (prev ? prev.map((r) => (r.id === activeId ? { ...r, unreadCount: 0 } : r)) : prev));
  }, [activeId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 4, padding: "12px 12px 10px", borderBottom: "1px solid var(--border)" }}>
        {TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12.5,
                border: "none",
                cursor: "pointer",
                color: active ? "var(--accent-ink)" : "#5b5f6b",
                background: active ? "var(--accent)" : "transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {rows === null && <p style={{ color: "#8a8478", fontSize: 13, padding: 16 }}>Cargando...</p>}
        {rows?.length === 0 && (
          <p style={{ color: "#8a8478", fontSize: 13, padding: 16 }}>
            {filter === "all" ? "Aún no hay conversaciones." : "No hay conversaciones que coincidan con este filtro."}
          </p>
        )}
        {rows?.map((c) => {
          const isActive = c.id === activeId;
          const label = c.name || "Contacto sin identificar";
          return (
            <Link
              key={c.id}
              href={`${basePath}/${c.id}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                textDecoration: "none",
                color: "inherit",
                borderBottom: "1px solid #f0efec",
                background: isActive ? "#e3f4ec" : c.unreadCount > 0 ? "#fff9f4" : "transparent",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  background: avatarColor(c.id),
                }}
              >
                {initials(c.name, c.phone)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: c.unreadCount > 0 ? 700 : 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    title={c.withinWindow ? "Ventana abierta" : "Ventana cerrada"}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: c.withinWindow ? "#12966b" : "#d8d4cb",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#8a8478",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.lastMessage
                    ? `${c.lastMessage.direction === "OUTBOUND" ? "Tú: " : ""}${c.lastMessage.body ?? "—"}`
                    : c.phone}
                </div>
                {c.assignedToLabel && (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 3,
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: "#5b5f6b",
                      background: "#f0efec",
                      borderRadius: 999,
                      padding: "1px 7px",
                    }}
                  >
                    {c.assignedToLabel}
                  </span>
                )}
              </div>
              {c.unreadCount > 0 && (
                <span
                  style={{
                    flexShrink: 0,
                    background: "var(--danger)",
                    color: "#fff",
                    fontSize: 10.5,
                    fontWeight: 700,
                    borderRadius: 999,
                    minWidth: 18,
                    height: 18,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 5px",
                  }}
                >
                  {c.unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
