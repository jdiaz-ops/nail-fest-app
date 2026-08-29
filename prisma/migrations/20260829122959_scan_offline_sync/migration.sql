-- AlterTable
ALTER TABLE "ScanLog" ADD COLUMN     "clientScanId" TEXT,
ADD COLUMN     "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "ScanLog_clientScanId_key" ON "ScanLog"("clientScanId");

