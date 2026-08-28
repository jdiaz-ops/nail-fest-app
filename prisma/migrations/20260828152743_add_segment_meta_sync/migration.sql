-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'OK', 'ERROR');

-- CreateTable
CREATE TABLE "SegmentMetaSync" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "metaAudienceId" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentMetaSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SegmentMetaSync_segmentId_key" ON "SegmentMetaSync"("segmentId");

-- AddForeignKey
ALTER TABLE "SegmentMetaSync" ADD CONSTRAINT "SegmentMetaSync_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "SegmentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

