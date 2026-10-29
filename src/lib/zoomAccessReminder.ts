// How long before a VIRTUAL/HYBRID event starts the personal Zoom link
// actually goes out (see WhatsAppAutomationTrigger.ZOOM_ACCESS_REMINDER's
// own schema comment for why it's withheld until then). 30 minutes is a
// reasonable default for "unos minutos antes" — change this single
// constant if the business wants a different lead time; there is no
// per-event override today. lib/registrationConfirmation.ts schedules it;
// Manicuristas Imparables' confirmation email says it
// (lib/imparables/confirmation.ts).
export const ZOOM_ACCESS_REMINDER_MINUTES_BEFORE = 30;
