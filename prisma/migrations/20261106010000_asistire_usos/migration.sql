-- «Asistiré» (2026-11-01, the team): who made her image and who took it, per event —
-- one row per person and step (AsistireUse in schema.prisma). Nothing of her photo.

-- CreateEnum
CREATE TYPE "AsistireStep" AS ENUM ('CREATED', 'DOWNLOADED');

-- CreateTable
CREATE TABLE "AsistireUse" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "personal" BOOLEAN NOT NULL,
    "step" "AsistireStep" NOT NULL,
    "times" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsistireUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsistireUse_eventId_step_idx" ON "AsistireUse"("eventId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "AsistireUse_eventId_person_step_key" ON "AsistireUse"("eventId", "person", "step");

-- AddForeignKey
ALTER TABLE "AsistireUse" ADD CONSTRAINT "AsistireUse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

