"use client";

import { showCuponeraNotice } from "@/components/cuponera/PreviewLink";

// The phone's own share sheet where there is one (WhatsApp, Instagram…);
// elsewhere, the link copied.
export default function ShareButton({ title }: { title: string }) {
  return (
    <button
      type="button"
      className="bib-btn bib-btn-line"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {
            // Closed without sharing.
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          showCuponeraNotice("Copiamos el enlace del video.");
        } catch {
          showCuponeraNotice(url);
        }
      }}
    >
      Compartir
    </button>
  );
}
