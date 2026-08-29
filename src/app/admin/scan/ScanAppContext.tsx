"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useOfflineScanEngine } from "@/lib/useOfflineScanEngine";

export interface EventInfo {
  id: string;
  name: string;
  city: string;
  startsAt: string;
  endsAt: string | null;
}

interface ScanAppContextValue extends ReturnType<typeof useOfflineScanEngine> {
  event: EventInfo;
  role: "ADMIN" | "STAFF";
  timezone: string;
  language: string;
  scannerLabel: string;
  setScannerLabel: (v: string) => void;
  // Escanear vs Lista is PURE client state, never a route change — see
  // ScanWorkspace's own comment on why: this app has no service worker,
  // so an App Router navigation to a route not already in the client
  // Router cache needs a real RSC fetch even for content that's already
  // sitting right here in memory, which fails exactly when offline is
  // exactly when switching tabs matters most (camera broke, need to
  // search the Doorlist instead). Only Dashboard (admin-only, genuinely
  // needs fresh server data, staff never touches it) stays a real route.
  subTab: "scanner" | "lista";
  setSubTab: (v: "scanner" | "lista") => void;
}

const ScanAppCtx = createContext<ScanAppContextValue | null>(null);

// One engine instance per event, shared by every tab (Dashboard/Escanear/
// Lista) — created here in the shell that wraps all three, so switching
// tabs doesn't re-download the roster or lose the pending-sync queue
// state; it's the same mounted provider the whole time you're inside one
// event.
export function ScanAppProvider({
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
  const [scannerLabel, setScannerLabelState] = useState("");
  const [subTab, setSubTab] = useState<"scanner" | "lista">("scanner");

  useEffect(() => {
    const saved = localStorage.getItem("nf_scan_label");
    if (saved) setScannerLabelState(saved);
  }, []);

  function setScannerLabel(v: string) {
    setScannerLabelState(v);
    localStorage.setItem("nf_scan_label", v);
  }

  const engine = useOfflineScanEngine(event.id, scannerLabel);

  return (
    <ScanAppCtx.Provider value={{ ...engine, event, role, timezone, language, scannerLabel, setScannerLabel, subTab, setSubTab }}>
      {children}
    </ScanAppCtx.Provider>
  );
}

export function useScanApp(): ScanAppContextValue {
  const ctx = useContext(ScanAppCtx);
  if (!ctx) throw new Error("useScanApp must be used within ScanAppProvider (see ScanAppShell)");
  return ctx;
}
