-- A designed confirmation email for an event (2026-10-29): "IMPARABLES",
-- Manicuristas Imparables' own, chosen in «Confirmación del evento». No
-- event uses it until someone chooses it there.
ALTER TABLE "Event" ADD COLUMN "confirmationEmailDesign" TEXT;
