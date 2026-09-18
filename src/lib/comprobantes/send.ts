import { db } from "@/lib/db";
import { subirComprobante } from "./contabilidadClient";
import { MEDIO_WIRE, type ArchivoAdjunto } from "./types";

// Every send attempt (the first, inline one right after creation, AND
// every QStash retry) funnels through here — one place that decides
// RECIBIDO vs. "try again" vs. give up, so the two call sites (the create
// route and the retry callback route) never drift on that logic. See
// Comprobante's own schema comment for what ENVIANDO/RECIBIDO/ENLAZADO/
// EN_REVISION/ERROR each mean.
const MAX_INTENTOS = 5;

/** Fetches this app's own Blob-hosted copy of one file and turns it into
 * the base64 attachment shape the backend contable's contract wants.
 * Re-fetched on every attempt (never held in memory across a retry, which
 * wouldn't survive a new serverless invocation anyway) — Blob is exactly
 * the durable copy this needs. */
async function fetchAsAttachment(url: string): Promise<ArchivoAdjunto> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`no se pudo leer el archivo de Blob (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "application/octet-stream";
  const nombre = decodeURIComponent(url.split("/").pop() || "comprobante");
  return { nombre, mime, base64: buffer.toString("base64") };
}

export interface SendAttemptResult {
  ok: boolean;
  // true = a transient failure that hasn't exhausted MAX_INTENTOS yet —
  // the caller (the QStash callback route) should return 500 so QStash
  // redelivers with its own backoff. false = there is nothing more to do
  // here, whatever the outcome (success, token_invalido, or exhausted).
  shouldRetry: boolean;
}

export async function intentarEnviarComprobante(id: string): Promise<SendAttemptResult> {
  const row = await db.comprobante.findUnique({ where: { id }, include: { user: { select: { username: true } } } });
  if (!row) return { ok: true, shouldRetry: false }; // deleted — nothing left to send

  // Backend already has this one (or already gave up on it) — resending
  // would be harmless (the backend is idempotent on comprobanteId), but
  // pointless, and a stray late QStash redelivery landing here shouldn't
  // silently resurrect a row a human already saw as ERROR and dismissed.
  if (row.estado !== "ENVIANDO") return { ok: row.estado !== "ERROR", shouldRetry: false };

  const intentos = row.intentos + 1;

  try {
    const archivos = await Promise.all(row.archivos.map(fetchAsAttachment));
    const result = await subirComprobante({
      comprobanteId: row.id,
      pendienteId: row.pendienteId,
      empresa: "AUDAZ LAB",
      medio: MEDIO_WIRE[row.medio],
      pagadoPor: row.pagadoPor,
      // This app only ever had a username for admin accounts, never a
      // real email field (see AdminUser's own schema) — passed through
      // as-is; the backend only uses it for display in the accounting
      // sheet, not for anything that requires a real address.
      usuarioEmail: row.user.username,
      nota: row.nota ?? "",
      fechaCaptura: row.createdAt.toISOString(),
      archivos,
    });

    if (result.ok) {
      await db.comprobante.update({
        where: { id },
        data: { estado: "RECIBIDO", driveFileIds: result.driveFileIds, intentos, ultimoError: null },
      });
      return { ok: true, shouldRetry: false };
    }

    // The one error the contract says never to retry — the token itself
    // is wrong, so retrying would just fail identically five more times.
    if (result.error === "token_invalido") {
      await db.comprobante.update({ where: { id }, data: { estado: "ERROR", intentos, ultimoError: result.error } });
      return { ok: false, shouldRetry: false };
    }

    if (intentos >= MAX_INTENTOS) {
      await db.comprobante.update({ where: { id }, data: { estado: "ERROR", intentos, ultimoError: result.error } });
      return { ok: false, shouldRetry: false };
    }

    await db.comprobante.update({ where: { id }, data: { intentos, ultimoError: result.error } });
    return { ok: false, shouldRetry: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "error de red desconocido";
    if (intentos >= MAX_INTENTOS) {
      await db.comprobante.update({ where: { id }, data: { estado: "ERROR", intentos, ultimoError: message } });
      return { ok: false, shouldRetry: false };
    }
    await db.comprobante.update({ where: { id }, data: { intentos, ultimoError: message } });
    return { ok: false, shouldRetry: true };
  }
}
