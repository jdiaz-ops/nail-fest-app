-- What the designed confirmation's «Compartir por WhatsApp» writes
-- (2026-10-30). Null keeps the message it always had.
ALTER TABLE "Event" ADD COLUMN "shareText" TEXT;
