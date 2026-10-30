-- The screen right after signing up (2026-10-30): "NAIL_FEST" shows Nail
-- Fest's own for an event at a place. Null for every event: the usual one.
ALTER TABLE "Event" ADD COLUMN     "signupScreenDesign" TEXT;
