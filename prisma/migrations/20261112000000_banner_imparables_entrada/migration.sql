-- Manicuristas Imparables' banner on an event's tickets: off until the team turns it on (2026-11-04).
ALTER TABLE "Event" ADD COLUMN "imparablesTicketBanner" BOOLEAN NOT NULL DEFAULT false;
