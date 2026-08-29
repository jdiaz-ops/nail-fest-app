-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "bouncedAt" TIMESTAMP(3),
ADD COLUMN     "complainedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "firstClickedAt" TIMESTAMP(3),
ADD COLUMN     "openedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EmailLog_sesMessageId_idx" ON "EmailLog"("sesMessageId");
