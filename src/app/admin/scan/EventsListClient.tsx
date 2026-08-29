"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateInTz } from "@/lib/dateFormat";

interface EventRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  startsAt: string;
  endsAt: string | null;
}

// Matches the real scanner app's own "Events" screen: Upcoming/Past
// tabs, tap an event to enter its Dashboard/Escanear/Lista shell. An
// event is "upcoming" if it hasn't fully ended yet (its own end date, or
// its start date for a one-day event with no end set) — same reasoning
// as the old dropdown's "only list events happening soon" comment, just
// with a real Past tab instead of just cutting old ones off.
function isUpcoming(ev: EventRow): boolean {
  const end = ev.endsAt ? new Date(ev.endsAt) : new Date(ev.startsAt);
  return end.getTime() >= Date.now();
}

export default function EventsListClient({
  events,
  downloadQr,
  downloadUrl,
  timezone,
  language,
}: {
  events: EventRow[];
  downloadQr: string | null;
  downloadUrl: string;
  timezone: string;
  language: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const upcoming = events.filter(isUpcoming).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const past = events.filter((e) => !isUpcoming(e));
  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <div style={{ minHeight: "100dvh", background: "#faf9f7" }}>
      <header style={{ background: "#14141c", color: "#fff", padding: "16px 20px" }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Eventos</div>
      </header>

      <div style={{ display: "flex", padding: "12px 16px 0", gap: 8 }}>
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: "1px solid " + (tab === t ? "#14141c" : "#e3e1dc"),
              background: tab === t ? "#14141c" : "#fff",
              color: tab === t ? "#fff" : "#14141c",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {t === "upcoming" ? "Próximos" : "Pasados"}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto" }}>
        {shown.length === 0 && (
          <p style={{ color: "#5b5f6b", fontSize: 14, textAlign: "center", marginTop: 24 }}>
            {tab === "upcoming" ? "No hay eventos próximos." : "No hay eventos pasados."}
          </p>
        )}
        {shown.map((ev) => (
          <Link
            key={ev.id}
            href={`/admin/scan/${ev.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px",
              marginBottom: 10,
              background: "#fff",
              border: "1px solid #e3e1dc",
              borderRadius: 12,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{ev.name}</div>
              <div style={{ fontSize: 13, color: "#5b5f6b", marginTop: 2 }}>
                {ev.city} · {formatDateInTz(new Date(ev.startsAt), { dateStyle: "medium" }, timezone, language)}
              </div>
            </div>
            <span style={{ color: "#8a8478", fontSize: 20 }}>›</span>
          </Link>
        ))}

        {downloadQr && (
          <div style={{ marginTop: 24, padding: 16, border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff" }}>
            <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Descargar la app para el staff</h2>
            <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: 0 }}>
              Que cada persona de la puerta escanee este código con SU celular, inicie sesión con su propio
              usuario, y luego lo agregue a su pantalla de inicio (Safari: Compartir → Agregar a inicio.
              Chrome/Android: menú → Instalar app). Una vez que inicie sesión no tiene que volver a hacerlo.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a
                  data: URI, not a remote image; next/image adds nothing here. */}
              <img src={downloadQr} alt={`Código QR hacia ${downloadUrl}`} width={130} height={130} style={{ borderRadius: 8, border: "1px solid #e3e1dc" }} />
              <div style={{ fontSize: 13, wordBreak: "break-all", color: "#5b5f6b" }}>{downloadUrl}</div>
            </div>
          </div>
        )}

        {downloadQr && (
          <button
            type="button"
            onClick={() => router.push("/admin")}
            style={{ marginTop: 20, background: "none", border: "none", color: "var(--link)", fontSize: 13, cursor: "pointer", padding: 0 }}
          >
            ← Volver al panel de administración
          </button>
        )}
      </div>
    </div>
  );
}
