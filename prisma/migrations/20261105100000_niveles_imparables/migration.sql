-- Manicuristas Imparables' ticket levels on the versions that sell them
-- (lib/imparables/tiers.ts): the fixed-price levels' ticket types, her level,
-- and what each payment pays for.
ALTER TABLE "TicketType" ADD COLUMN "tierSlug" TEXT;
CREATE UNIQUE INDEX "TicketType_eventId_tierSlug_key" ON "TicketType"("eventId", "tierSlug");

ALTER TABLE "Registration" ADD COLUMN "tierSlug" TEXT;

ALTER TABLE "Payment" ADD COLUMN "tierSlug" TEXT;
ALTER TABLE "Payment" ADD COLUMN "upgradeFrom" TEXT;
