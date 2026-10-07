// Why an email didn't land, in terms an admin can act on — the email twin
// of lib/whatsapp/failureCategories.ts. Two kinds of failure exist here:
// the provider refused the send outright (EmailLog.status FAILED, with the
// provider's error in errorMessage) or it went out and came back (BOUNCED /
// COMPLAINED via the webhooks, with the bounce type/diagnostic in
// errorMessage where the provider gave one — rows from before 2026-10-07
// have none).

import type { EmailLogStatus } from "@prisma/client";
import type { FailureCategoryInfo } from "@/lib/whatsapp/failureCategories";

export type EmailFailureCategory = "address" | "mailbox" | "complaint" | "transient" | "bounce_unknown" | "unknown";

export const EMAIL_FAILURE_INFO: Record<EmailFailureCategory, FailureCategoryInfo> = {
  address: {
    label: "Dirección inválida o buzón inexistente",
    action: "Rebote duro. Reintentar no sirve: corrige el correo en el CRM o deja que la app lo deje de contactar.",
    retryable: false,
  },
  mailbox: {
    label: "Buzón lleno o rechazo temporal",
    action: "Rebote blando. Vuelve a intentar en unas horas o al día siguiente.",
    retryable: true,
  },
  complaint: {
    label: "Marcó el correo como spam",
    action: "No volver a escribirle. La app ya retiró su consentimiento de marketing.",
    retryable: false,
  },
  transient: {
    label: "Error pasajero del proveedor",
    action: "Límite de velocidad, cuota diaria o caída momentánea. \"Reintentar recuperables\" los rescata.",
    retryable: true,
  },
  bounce_unknown: {
    label: "Rebote sin detalle",
    action: "El proveedor no dijo por qué (o es anterior al registro de motivos). Revisa la dirección antes de volver a enviar.",
    retryable: false,
  },
  unknown: {
    label: "Sin clasificar",
    action: "Motivo que no reconocemos todavía. Se incluye en el reintento una vez; si vuelve a fallar, revisa el detalle.",
    retryable: true,
  },
};

export function categorizeEmailFailure(status: EmailLogStatus, errorMessage: string | null | undefined): EmailFailureCategory | null {
  const text = (errorMessage ?? "").toLowerCase();
  if (status === "COMPLAINED") return "complaint";
  if (status === "BOUNCED") {
    if (!text) return "bounce_unknown";
    if (/permanent|hard|5\.1\.[0-9]|5\.4\.[0-9]|does not exist|no such user|unknown user|user unknown|invalid recipient|not found|unroutable|suppress/.test(text)) return "address";
    if (/transient|soft|4\.[0-9]\.[0-9]|mailbox full|over quota|quota exceeded|too large|greylist|try again|temporar|deferred|delayed/.test(text)) return "mailbox";
    return "bounce_unknown";
  }
  if (status === "FAILED") {
    if (/rate_limit|rate limit|429|too many|daily_quota|quota|internal_server|5\d\d|timeout|timed out|econnreset|etimedout|fetch failed|network|throttl|service unavailable/.test(text)) return "transient";
    if (/validation_error|invalid.*(email|address|recipient|to)|not a valid|suppress|blocklist|blacklist|bounced previously/.test(text)) return "address";
    return "unknown";
  }
  return null;
}
