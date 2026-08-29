-- CreateEnum
CREATE TYPE "BroadcastScheduleKind" AS ENUM ('IMMEDIATE', 'AT_DATETIME', 'BEFORE_EVENT_START', 'AFTER_EVENT_END');

-- DropForeignKey
ALTER TABLE "EmailBroadcast" DROP CONSTRAINT "EmailBroadcast_segmentId_fkey";

-- AlterTable
ALTER TABLE "EmailBroadcast" ADD COLUMN     "bodyHtml" TEXT,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "scheduleKind" "BroadcastScheduleKind" NOT NULL DEFAULT 'IMMEDIATE',
ADD COLUMN     "scheduleOffsetMinutes" INTEGER,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "ticketTypeId" TEXT,
ALTER COLUMN "segmentId" DROP NOT NULL,
ALTER COLUMN "bodyText" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "EmailBroadcast_status_scheduleKind_idx" ON "EmailBroadcast"("status", "scheduleKind");

-- AddForeignKey
ALTER TABLE "EmailBroadcast" ADD CONSTRAINT "EmailBroadcast_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "SegmentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBroadcast" ADD CONSTRAINT "EmailBroadcast_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBroadcast" ADD CONSTRAINT "EmailBroadcast_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

