-- The name an event's emails come from, set in «Correos del evento» (2026-11-04). Null: its brand's.
ALTER TABLE "Event" ADD COLUMN "emailSenderName" TEXT;
