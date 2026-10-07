// Why a WhatsApp send failed, in terms an admin can act on. Every FAILED
// WhatsAppMessage row carries Meta's own reason (see lib/whatsapp/inbox.ts's
// handleStatusUpdate — "[code] title — detail" — and meta.ts's graphFetch,
// which throws the raw Cloud API error JSON on an immediate rejection).
// Meta publishes ~60 error codes; what matters for a plan of action is
// which of four buckets each lands in, and whether retrying can help at all.
// Codes: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

export type WhatsAppFailureCategory = "number" | "meta" | "template" | "transient" | "unknown";

export interface FailureCategoryInfo {
  label: string;
  action: string;
  /** Whether "Reintentar fallidos" should touch this group at all. */
  retryable: boolean;
}

export const WHATSAPP_FAILURE_INFO: Record<WhatsAppFailureCategory, FailureCategoryInfo> = {
  number: {
    label: "Número sin WhatsApp o mal escrito",
    action: "Reintentar no sirve. Corrige o limpia el celular en el CRM. Tras dos fallos así, la app retira sola el consentimiento de WhatsApp.",
    retryable: false,
  },
  meta: {
    label: "Meta frenó el mensaje para ese usuario",
    action: "No es culpa del número. No reintentes hoy: les llega en la siguiente difusión o con otra plantilla.",
    retryable: false,
  },
  template: {
    label: "Plantilla, variables o configuración",
    action: "Revisa la plantilla, el mapeo de variables o la cuenta de Meta y luego reintenta. Suele afectar a muchos a la vez.",
    retryable: true,
  },
  transient: {
    label: "Error pasajero",
    action: "Límite de velocidad o caída momentánea de Meta. \"Reintentar recuperables\" los rescata.",
    retryable: true,
  },
  unknown: {
    label: "Sin clasificar",
    action: "Motivo que no reconocemos todavía. Se incluye en el reintento una vez; si vuelve a fallar, revisa el detalle.",
    retryable: true,
  },
};

const NUMBER_CODES = new Set([131026, 131021]);
const META_CODES = new Set([131049, 130472, 131047, 131048, 130497]);
const TEMPLATE_CODES = new Set([132000, 132001, 132005, 132007, 132012, 132015, 132016, 132068, 132069, 131008, 131051, 131052, 131053, 131030, 131031]);
const TRANSIENT_CODES = new Set([130429, 131056, 131000, 131016, 131042, 131045, 133000, 133004, 133005, 133006, 133008, 133009, 133010, 133015, 135000]);
// "Parameter value is not valid" / generic invalid parameter — a bad phone
// number OR a bad template variable; the detail text tells which.
const PARAMETER_CODES = new Set([131009, 100]);

/** The Meta error code inside a stored errorMessage, whichever of the two
 * shapes this app writes: "[131026] Message undeliverable — …" (webhook)
 * or 'WhatsApp Cloud API 400 on …: {"error":{"code":131026,…}}' (immediate
 * rejection). Null when there is none (a network error, an app bug). */
export function extractMetaErrorCode(errorMessage: string | null | undefined): number | null {
  if (!errorMessage) return null;
  const bracket = /^\s*\[(\d{3,6})\]/.exec(errorMessage);
  if (bracket) return Number(bracket[1]);
  const json = /"code"\s*:\s*(\d{3,6})/.exec(errorMessage);
  if (json) return Number(json[1]);
  return null;
}

export function categorizeWhatsAppFailure(errorMessage: string | null | undefined): WhatsAppFailureCategory {
  const code = extractMetaErrorCode(errorMessage);
  const text = (errorMessage ?? "").toLowerCase();
  if (code != null) {
    if (NUMBER_CODES.has(code)) return "number";
    if (META_CODES.has(code)) return "meta";
    if (TEMPLATE_CODES.has(code)) return "template";
    if (TRANSIENT_CODES.has(code)) return "transient";
    if (PARAMETER_CODES.has(code)) {
      return /phone|recipient|wa_id|número|numero|\bto\b/.test(text) ? "number" : "template";
    }
    if (code >= 132000 && code < 133000) return "template";
    if (code >= 133000 && code < 134000) return "transient";
    return "unknown";
  }
  // No Meta code at all: the request never got an answer, or our side
  // broke before calling Meta.
  if (/cloud api 5\d\d|fetch failed|timeout|timed out|econnreset|etimedout|enotfound|socket hang up|network/.test(text)) return "transient";
  if (/cloud api 429/.test(text)) return "transient";
  if (text.length === 0) return "unknown";
  return "unknown";
}
