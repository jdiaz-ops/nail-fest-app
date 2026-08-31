"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nf_cookie_consent_ack";

// Only rendered at all when OrgSettings.cookieConsentEnabled is true (see
// layout.tsx) — this is the general "this site uses cookies" notice our
// previous ticketing platform shows whenever a tracking pixel is active. It's informational,
// not a gate: the Meta Pixel/CAPI already only fire after the explicit
// "Autorizo compartir mis datos con Meta" checkbox on the form, which is
// the real consent that matters for that purpose.
export default function CookieConsentBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Storage blocked (private mode, locked-down browser) — just don't
      // show the banner rather than throwing on every page load.
    }
  }, []);

  if (dismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        padding: "12px 16px",
        background: "#1c1310",
        color: "#fff",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 13,
      }}
    >
      <span>
        Usamos cookies para mostrarte publicidad relevante.{" "}
        <a href="/privacidad" style={{ color: "#ffc5a8" }}>
          Más información
        </a>
        .
      </span>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, "1");
          } catch {
            // Ignore — worst case the banner shows again next visit.
          }
          setDismissed(true);
        }}
        style={{ padding: "6px 16px", borderRadius: 999, border: "none", background: "#ffc5a8", color: "#1c1310", fontWeight: 600 }}
      >
        Aceptar
      </button>
    </div>
  );
}
