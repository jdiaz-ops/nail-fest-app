"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import DuplicateEventButton from "./DuplicateEventButton";
import DeleteEventButton from "./DeleteEventButton";

// The per-event "module" — our previous ticketing platform's own
// left-nav-scoped-to-one-event pattern, which the user walked through
// screenshot by screenshot before
// asking for this. Wraps every /admin/events/[id]/* page (see the sibling
// layout.tsx) so each sub-page only needs to render its own content, not
// its own copy of this nav. Client component: needs usePathname to
// highlight the active item, same reasoning as AdminTopNav one level up.
export default function EventModuleShell({
  eventId,
  eventName,
  eventWhen,
  statusLabel,
  eventSlug,
  children,
}: {
  eventId: string;
  eventName: string;
  eventWhen: string;
  statusLabel: string;
  eventSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const base = `/admin/events/${eventId}`;

  const groups: { heading?: string; items: { href: string; label: string; exact?: boolean }[] }[] = [
    {
      items: [
        { href: base, label: "Resumen del evento", exact: true },
        { href: `${base}/reports`, label: "Reportes del evento" },
      ],
    },
    {
      heading: "Administrar",
      items: [
        { href: `${base}/tickets`, label: "Entradas emitidas" },
        { href: `${base}/broadcasts`, label: "Correos del evento" },
      ],
    },
    {
      heading: "Configuración",
      items: [
        { href: `${base}/edit`, label: "Editar evento y entradas" },
        { href: `${base}/confirmation`, label: "Confirmación del evento" },
      ],
    },
  ];

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Link href="/admin/events" style={{ fontSize: 13, color: "#5b5f6b", textDecoration: "none" }}>
          ← Todos los eventos
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>{eventName}</h1>
          <div style={{ fontSize: 13, color: "#5b5f6b" }}>{eventWhen}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: statusLabel === "Publicado" ? "#e8f6ef" : "#f6f5f2",
              color: statusLabel === "Publicado" ? "#0e6b4c" : "#5b5f6b",
              border: "1px solid " + (statusLabel === "Publicado" ? "#9fd8bd" : "#e3e1dc"),
            }}
          >
            {statusLabel}
          </span>
          <a href={`/${eventSlug}`} target="_blank" rel="noreferrer" className="secondary" style={{ fontSize: 13, padding: "8px 14px" }}>
            Ver página del evento ↗
          </a>
        </div>
      </div>

      <div className="admin-sidebar-layout">
        <nav className="admin-sidebar-nav" style={{ width: 220, flexShrink: 0 }}>
          {groups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 20 }}>
              {group.heading && (
                <div style={{ fontSize: 11, color: "#8a8478", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, paddingLeft: 12 }}>
                  {group.heading}
                </div>
              )}
              {group.items.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "block",
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 14,
                      textDecoration: "none",
                      color: active ? "#0b2e2c" : "#1c1310",
                      background: active ? "#e6f9f7" : "transparent",
                      fontWeight: active ? 600 : 400,
                      marginBottom: 2,
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#8a8478", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, paddingLeft: 12 }}>
              Acciones
            </div>
            <DuplicateEventButton eventId={eventId} />
            <DeleteEventButton eventId={eventId} />
          </div>
        </nav>

        <div className="admin-sidebar-content">{children}</div>
      </div>
    </div>
  );
}
