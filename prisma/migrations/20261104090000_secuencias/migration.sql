-- «Secuencias» (2026-10-30): automatic follow-ups — a WhatsApp and emails —
-- for the people of a saved segment, the abandoned carts first. New tables
-- only; nothing existing changes. Every sequence starts off.

-- CreateEnum
CREATE TYPE "SequenceChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "SequenceSendStatus" AS ENUM ('SENDING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "eventId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "channel" "SequenceChannel" NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "buttonText" TEXT,
    "buttonTarget" TEXT,
    "templateId" TEXT,
    "variableMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceEnrollment" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outSince" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,

    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceSend" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" "SequenceSendStatus" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SequenceSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SequenceStep_sequenceId_position_idx" ON "SequenceStep"("sequenceId", "position");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_sequenceId_endedAt_idx" ON "SequenceEnrollment"("sequenceId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceEnrollment_sequenceId_personId_key" ON "SequenceEnrollment"("sequenceId", "personId");

-- CreateIndex
CREATE INDEX "SequenceSend_stepId_status_idx" ON "SequenceSend"("stepId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceSend_enrollmentId_stepId_key" ON "SequenceSend"("enrollmentId", "stepId");

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "SegmentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceSend" ADD CONSTRAINT "SequenceSend_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SequenceEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceSend" ADD CONSTRAINT "SequenceSend_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "SequenceStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

