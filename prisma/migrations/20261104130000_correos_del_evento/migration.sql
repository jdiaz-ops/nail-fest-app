-- An event's emails in a design (2026-10-30): "NAIL_FEST" frames them in
-- Nail Fest's; null for every event: as always. And each email's optional
-- band under that design's header.
ALTER TABLE "Event" ADD COLUMN     "broadcastDesign" TEXT;
ALTER TABLE "EmailBroadcast" ADD COLUMN     "designBand" TEXT;
