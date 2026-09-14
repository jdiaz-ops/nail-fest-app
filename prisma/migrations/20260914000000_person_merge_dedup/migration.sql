-- Additive only: adds dedup bookkeeping to Person, never touches or
-- re-points any existing relation (Registration, Consent, EmailLog,
-- WhatsAppConversation, Label all keep pointing at whatever Person row
-- they already point at).
ALTER TABLE "Person" ADD COLUMN "mergedIntoId" TEXT;
ALTER TABLE "Person" ADD COLUMN "mergedAt" TIMESTAMP(3);
ALTER TABLE "Person" ADD COLUMN "mergeReason" TEXT;

CREATE INDEX "Person_mergedIntoId_idx" ON "Person"("mergedIntoId");

ALTER TABLE "Person" ADD CONSTRAINT "Person_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
