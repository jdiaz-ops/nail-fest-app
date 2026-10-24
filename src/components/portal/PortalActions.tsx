"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "./fields";
import { PortalIcon } from "./icons";

/** "Compartir mi enlace": the phone's share sheet, or the link copied. */
export function ShareLinkButton({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="bib-btn bib-btn-line bib-btn-sm"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title: `${name} · Instructoras Nail Fest`, url });
          } catch {
            // Closed without sharing.
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt("Copia tu enlace:", url);
        }
      }}
    >
      <PortalIcon name="share" size={16} />
      {copied ? "Enlace copiado" : "Compartir mi enlace"}
    </button>
  );
}

/** A profile she made but never sent: off to the team. */
export function SubmitReviewButton() {
  const router = useRouter();
  const [state, setState] = useState<{ sending: boolean; message: string | null }>({ sending: false, message: null });
  return (
    <>
      <button
        type="button"
        className="bib-btn bib-btn-main bib-btn-sm"
        disabled={state.sending}
        onClick={async () => {
          setState({ sending: true, message: null });
          const result = await send("/api/instructoras/perfil/enviar");
          setState({ sending: false, message: result.ok ? null : result.message });
          if (result.ok) router.refresh();
        }}
      >
        {state.sending ? "Enviando…" : "Enviar a revisión"}
      </button>
      {state.message && (
        <p className="pt-error" role="alert">
          {state.message}
        </p>
      )}
    </>
  );
}
