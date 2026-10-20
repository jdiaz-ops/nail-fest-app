"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { announceCuponeraSaved, CardTitle, cardStyle, mutedText, Pill, primaryButtonStyle } from "./ui";

type SyncResult =
  | { ok: true; brands: number; products: number; brandsAdded: number; productsAdded: number; productsGone: number; servedFrom?: string }
  | { ok: false; error: string };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// The Marcolini connection: whether it's set up, how the last sync went,
// and "Sincronizar ahora".
export default function CuponeraSyncCard(props: {
  configured: boolean;
  marcoliniHost: string | null;
  /** Last characters of the key Nail Fest sends, to compare with Marcolini's. */
  keyHint: string | null;
  /** Already formatted on the server: Node's and the browser's date
   * formatting differ in small ways and would break hydration. */
  lastSyncLabel: string | null;
  lastSyncOk: boolean | null;
  lastSyncError: string | null;
  lastSyncBrands: number | null;
  lastSyncProducts: number | null;
  creatorName: string | null;
  creatorSlug: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function sync() {
    setSyncing(true);
    setMessage(null);
    try {
      const result = await fetch("/api/admin/cuponera/sync", { method: "POST" }).then((r) => r.json() as Promise<SyncResult>);
      if (result.ok) {
        const changes = [
          result.brandsAdded > 0 ? plural(result.brandsAdded, "marca nueva", "marcas nuevas") : null,
          result.productsAdded > 0 ? plural(result.productsAdded, "producto nuevo", "productos nuevos") : null,
          result.productsGone > 0 ? plural(result.productsGone, "producto que ya no está", "productos que ya no están") : null,
        ].filter(Boolean);
        setMessage({
          ok: true,
          text: `Listo: ${plural(result.brands, "marca", "marcas")} y ${plural(result.products, "producto", "productos")}${changes.length ? ` (${changes.join(", ")})` : ", sin cambios"}.${
            result.servedFrom && result.servedFrom !== props.marcoliniHost ? ` Marcolini respondió desde ${result.servedFrom}.` : ""
          }`,
        });
        announceCuponeraSaved();
      } else {
        setMessage({ ok: false, text: result.error });
      }
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "No se pudo sincronizar. Revisa tu conexión y vuelve a intentarlo." });
    } finally {
      setSyncing(false);
    }
  }

  const status = !props.configured ? (
    <Pill tone="grey">Falta configurar</Pill>
  ) : props.lastSyncOk === true ? (
    <Pill tone="green">Conectada</Pill>
  ) : props.lastSyncOk === false ? (
    <Pill tone="red">Con error</Pill>
  ) : (
    <Pill tone="grey">Sin sincronizar</Pill>
  );

  return (
    <div style={cardStyle}>
      <CardTitle aside={status}>Conexión con Marcolini</CardTitle>

      {!props.configured ? (
        <p style={mutedText}>
          Para conectarla, agrega en Vercel (Settings → Environment Variables) la variable <code>MARCOLINI_API_KEY</code> con la llave
          que Marcolini le dio a Nail Fest, y vuelve a desplegar.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, ...mutedText }}>
          {props.creatorName && (
            <span>
              Cuenta de creadora: <b style={{ color: "#17181c" }}>{props.creatorName}</b>
              {props.creatorSlug ? ` (${props.creatorSlug})` : ""}
            </span>
          )}
          <span>
            Se conecta a <b style={{ color: "#17181c" }}>{props.marcoliniHost}</b> con la llave{" "}
            <b style={{ color: "#17181c", fontFamily: "ui-monospace, Menlo, monospace" }}>{props.keyHint}</b>
          </span>
          {props.lastSyncLabel && (
            <span>
              Última sincronización: {props.lastSyncLabel}
              {props.lastSyncOk && props.lastSyncBrands != null && props.lastSyncProducts != null
                ? ` — ${plural(props.lastSyncBrands, "marca", "marcas")}, ${plural(props.lastSyncProducts, "producto", "productos")}`
                : ""}
            </span>
          )}
        </div>
      )}

      {props.lastSyncOk === false && props.lastSyncError && (
        <p style={{ background: "#fde8ef", color: "#8a1c47", borderRadius: 8, padding: "10px 12px", fontSize: 13, margin: "12px 0 0" }}>
          {props.lastSyncError}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={sync} disabled={syncing || !props.configured} style={{ ...primaryButtonStyle, opacity: syncing || !props.configured ? 0.6 : 1 }}>
          {syncing ? "Sincronizando…" : "Sincronizar ahora"}
        </button>
        {message && (
          <span role="status" style={{ fontSize: 13, color: message.ok ? "#0d6e4f" : "#b0225c" }}>
            {message.text}
          </span>
        )}
      </div>

      <p style={{ ...mutedText, fontSize: 12, marginBottom: 0 }}>
        Se sincroniza sola todos los días a las 5:00 a. m. Solo entran las marcas que tienen a Nail Fest aceptada en Marcolini, con el
        código de Nail Fest en cada una; si una marca saca a Nail Fest, sale de la cuponera en la siguiente sincronización.
      </p>
    </div>
  );
}
