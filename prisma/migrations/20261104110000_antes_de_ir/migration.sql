-- «Antes de ir» in Nail Fest's own in-person confirmation email (2026-10-30):
-- the event's own lines. Empty for every event: the email then shows three
-- general ones.
ALTER TABLE "Event" ADD COLUMN     "confirmationTips" TEXT[] DEFAULT ARRAY[]::TEXT[];
