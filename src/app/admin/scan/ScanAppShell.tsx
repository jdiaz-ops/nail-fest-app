"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { formatDateInTz } from "@/lib/dateFormat";
import { ScanAppProvider, useScanApp, type EventInfo } from "./ScanAppContext";
import { DashboardIcon, ScannerIcon, ListIcon, HomeIcon, ChatIcon } from "./icons";

export default function ScanAppShell({
  event,
  role,
  timezone,
  language,
  children,
}: {
  event: EventInfo;
  role: "ADMIN" | "STAFF";
  timezone: string;
  language: string;
  children: React.ReactNode;
}) {
  return (
    <ScanAppProvider event={event} role={role} timezone={timezone} language={language}>
      <div style={{ minHeight: "100dvh", background: "#faf9f7", display: "flex", flexDirection: "column" }}>
        <ShellHeader />
        <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto", padding: "16px 16px 88px" }}>{children}</div>
        <BottomTabs />
      </div>
    </ScanAppProvider>
  );
}

function ShellHeader() {
  const { event, timezone, language, isOnline, pendingCount, syncing, roster, downloadingRoster, downloadRoster, syncQueue, scannerLabel, setScannerLabel } =
    useScanApp();

  return (
    <header style={{ background: "#14141c", color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
        <Link href="/admin/scan" aria-label="Volver a Eventos" style={{ color: "#fff", display: "flex" }}>
          <HomeIcon />
        </Link>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.name}</div>
          <div style={{ fontSize: 12, color: "#c9c5ba" }}>
            {formatDateInTz(new Date(event.startsAt), { dateStyle: "medium" }, timezone, language)}
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", color: "#14141c", padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <StatusPill label={isOnline ? "En línea" : "Sin conexión"} color={isOnline ? "#0e6b4c" : "#a3212b"} bg={isOnline ? "#e8f6ef" : "#fbe9ea"} />
        {pendingCount > 0 && (
          <StatusPill
            label={syncing ? `Sincronizando… (${pendingCount})` : `${pendingCount} sin sincronizar`}
            color="#8a5a1f"
            bg="#fdf1e6"
            onClick={syncQueue}
          />
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#5b5f6b" }}>
          {downloadingRoster ? "Descargando…" : roster ? `Datos: ${roster.count} · ${relativeTime(roster.downloadedAt)}` : "Sin datos offline"}{" "}
          <button type="button" onClick={() => downloadRoster(event.id)} disabled={downloadingRoster} style={linkStyle}>
            Actualizar
          </button>
        </span>
      </div>

      <details style={{ background: "#fff", color: "#14141c", padding: "0 16px", fontSize: 12 }}>
        <summary style={{ padding: "6px 0", color: "#5b5f6b", cursor: "pointer" }}>
          Etiqueta de este dispositivo {scannerLabel ? `— ${scannerLabel}` : ""}
        </summary>
        <input
          value={scannerLabel}
          onChange={(e) => setScannerLabel(e.target.value)}
          placeholder="Puerta 1 - celular de Juan"
          style={{ width: "100%", padding: "6px 8px", marginBottom: 8, border: "1px solid #e3e1dc", borderRadius: 6, fontSize: 13 }}
        />
      </details>
    </header>
  );
}

function BottomTabs() {
  const { role, event, subTab, setSubTab } = useScanApp();
  const pathname = usePathname();
  const router = useRouter();
  const base = `/admin/scan/${event.id}`;
  const scannerRoute = `${base}/scanner`;
  const onScannerRoute = pathname === scannerRoute;

  // Dashboard is a real route (admin-only, genuinely needs fresh server
  // data) — Escanear/Lista are local state within that same route, see
  // ScanWorkspace's own comment on why. Tapping either while on Dashboard
  // still has to navigate once, same as any first visit; from then on,
  // switching between them is instant and offline-safe.
  function goToSubTab(tab: "scanner" | "lista") {
    setSubTab(tab);
    if (!onScannerRoute) router.push(scannerRoute);
  }

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#fff",
        borderTop: "1px solid #e3e1dc",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {role === "ADMIN" && (
        <Link
          href={base}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: "10px 0 8px",
            textDecoration: "none",
            color: pathname === base ? "var(--accent-ink)" : "#8a8478",
          }}
        >
          <DashboardIcon />
          <span style={{ fontSize: 11, fontWeight: pathname === base ? 700 : 400 }}>Dashboard</span>
        </Link>
      )}
      {(
        [
          { key: "scanner" as const, label: "Escanear", icon: <ScannerIcon /> },
          { key: "lista" as const, label: "Lista", icon: <ListIcon /> },
        ]
      ).map((tab) => {
        const active = onScannerRoute && subTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => goToSubTab(tab.key)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "10px 0 8px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: active ? "var(--accent-ink)" : "#8a8478",
            }}
          >
            {tab.icon}
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>{tab.label}</span>
          </button>
        );
      })}
      {role === "ADMIN" && (
        <Link
          href={`${base}/bandeja`}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: "10px 0 8px",
            textDecoration: "none",
            color: pathname.startsWith(`${base}/bandeja`) ? "var(--accent-ink)" : "#8a8478",
          }}
        >
          <ChatIcon />
          <span style={{ fontSize: 11, fontWeight: pathname.startsWith(`${base}/bandeja`) ? 700 : 400 }}>Bandeja</span>
        </Link>
      )}
    </nav>
  );
}

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function StatusPill({ label, color, bg, onClick }: { label: string; color: string; bg: string; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {label}
    </span>
  );
}

const linkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--link)",
  cursor: "pointer",
  fontSize: 12,
  padding: 0,
  textDecoration: "underline",
};
