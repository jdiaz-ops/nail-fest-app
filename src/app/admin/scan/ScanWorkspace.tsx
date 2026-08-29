"use client";

import { useScanApp } from "./ScanAppContext";
import ScannerTab from "./ScannerTab";
import DoorlistTab from "./DoorlistTab";

// Escanear and Lista live at the SAME route and stay mounted together —
// only their visibility toggles (via subTab in ScanAppContext), never a
// real navigation. Two reasons: (1) this app has no service worker, so
// switching to a route the browser hasn't already fetched needs a real
// network round trip even under Next's client-side router — which is
// exactly when this matters most, mid-outage, camera broken, needing the
// searchable list instead; (2) keeping ScannerTab mounted (just hidden)
// while on Lista means the camera stream never has to restart when
// flipping back — instant, not a multi-second re-init.
export default function ScanWorkspace() {
  const { subTab } = useScanApp();

  return (
    <>
      <div style={{ display: subTab === "scanner" ? "block" : "none" }}>
        <ScannerTab />
      </div>
      <div style={{ display: subTab === "lista" ? "block" : "none" }}>
        <DoorlistTab />
      </div>
    </>
  );
}
