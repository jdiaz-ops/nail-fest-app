// How long before a VIRTUAL/HYBRID event starts the personal Zoom link
// actually goes out (see WhatsAppAutomationTrigger.ZOOM_ACCESS_REMINDER's
// own schema comment for why it's withheld until then). 15 minutes since
// 2026-10-30 (it was 30), the team's choice for "unos minutos antes" —
// change this single constant if the business wants a different lead time;
// there is no per-event override today. lib/registrationConfirmation.ts
// schedules it when a purchase is confirmed (one confirmed earlier keeps its
// time); Manicuristas Imparables' confirmation email and its calendar say it
// (lib/imparables/confirmation.ts).
export const ZOOM_ACCESS_REMINDER_MINUTES_BEFORE = 15;
