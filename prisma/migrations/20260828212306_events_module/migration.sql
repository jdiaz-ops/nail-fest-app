-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
-- updatedAt backfills existing rows via DEFAULT CURRENT_TIMESTAMP instead
-- of Prisma's usual "no default" — this table is not empty in production
-- (already-live events), and @updatedAt only takes over from the next
-- write onward; the column still needs *some* value for rows that exist
-- right now.
ALTER TABLE "Event" ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "venueAddress" TEXT,
ADD COLUMN     "venueName" TEXT;

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");
