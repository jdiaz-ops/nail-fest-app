"use client";

import { useState } from "react";
import { openWompiWidget } from "@/components/wompiWidget";
import type { WompiWidgetParams } from "@/lib/payments/wompi";

// Her button to move up a ticket level (lib/imparables/tiers.ts, 2026-10-31),
// on her page nailfest.lat/mejorar/<her link>: asks /api/mejorar for the
// payment of the difference and opens Wompi's window over the page; once
// it's paid, back to her page with the transaction, where it's confirmed.
export default function ImpUpgrade({ token, tier, label, email }: { token: string; tier: string; label: string; email: string }) {
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function go() {
    setPaying(true);
    setMessage(null);
    const res = await fetch("/api/mejorar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, tier }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { checkoutUrl?: string; wompi?: WompiWidgetParams; message?: string } | null;
    if (!res?.ok || !body) {
      setPaying(false);
      setMessage(body?.message ?? "No pudimos abrir el pago. Revisa tu conexión e intenta de nuevo.");
      return;
    }
    const wompi = body.wompi;
    const opened = wompi
      ? await openWompiWidget(wompi, { email }, (transactionId) => {
          if (transactionId) {
            const back = new URL(wompi.redirectUrl);
            back.searchParams.set("id", transactionId);
            window.location.assign(back.toString());
          } else {
            setPaying(false);
            setMessage("Cerraste la ventana de pago sin terminar. Puedes intentarlo de nuevo cuando quieras.");
          }
        })
      : false;
    if (!opened && body.checkoutUrl) window.location.assign(body.checkoutUrl);
  }

  return (
    <>
      <button type="button" className="imp-cta" onClick={go} disabled={paying}>
        {paying ? "Abriendo el pago…" : label}
      </button>
      {message && (
        <p className="imp-up-msg" role="alert">
          {message}
        </p>
      )}
    </>
  );
}
