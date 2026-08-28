-- Defensive dedup, run before the unique constraint below can be created.
-- Nothing before this migration prevented the live registration form from
-- creating two Registration rows for the same person+event (e.g. an
-- accidental double-submit during testing) — this makes the migration
-- succeed regardless of whether that ever actually happened, instead of
-- assuming it didn't. Keeps the most recently created row per
-- (personId, eventId) pair, deletes the rest. Consent/MetaEvent rows that
-- pointed at a deleted duplicate have their registrationId set to NULL
-- (ON DELETE SET NULL, not dropped) rather than being deleted themselves.
-- A no-op if there are no duplicates.
DELETE FROM "Registration" r
USING (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "personId", "eventId" ORDER BY "createdAt" DESC, id DESC
  ) AS rn
  FROM "Registration"
) dup
WHERE r.id = dup.id AND dup.rn > 1;

-- DropIndex
DROP INDEX "Registration_personId_idx";

-- AlterTable
ALTER TABLE "Registration" DROP COLUMN "checkedIn",
ADD COLUMN     "checkedInCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ticketCount" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Registration_personId_eventId_key" ON "Registration"("personId", "eventId");

