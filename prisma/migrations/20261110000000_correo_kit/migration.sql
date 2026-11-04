-- Manicuristas Imparables' design for its event's emails (the team, 2026-11-04): each email can carry her kit —
-- wallpapers, story templates and her profile frame — after its message. On by default, like her «Asistiré» card.
ALTER TABLE "EmailBroadcast" ADD COLUMN "designKit" BOOLEAN NOT NULL DEFAULT true;
