-- CreateEnum
CREATE TYPE "ScanResult" AS ENUM ('VALID_FIRST', 'VALID_REENTRY', 'WRONG_EVENT', 'INVALID_TOKEN', 'NOT_FOUND');

-- CreateTable
CREATE TABLE "ScanLog" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT,
    "token" TEXT NOT NULL,
    "result" "ScanResult" NOT NULL,
    "scannedForEventId" TEXT,
    "scannerLabel" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanLog_registrationId_idx" ON "ScanLog"("registrationId");

-- CreateIndex
CREATE INDEX "ScanLog_scannedForEventId_scannedAt_idx" ON "ScanLog"("scannedForEventId", "scannedAt");

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_scannedForEventId_fkey" FOREIGN KEY ("scannedForEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
