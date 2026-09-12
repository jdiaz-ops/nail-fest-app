-- CreateTable
CREATE TABLE "ZoomAttendanceLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registrationId" TEXT,
    "participantEmail" TEXT,
    "zoomParticipantId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoomAttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZoomAttendanceLog_eventId_idx" ON "ZoomAttendanceLog"("eventId");

-- CreateIndex
CREATE INDEX "ZoomAttendanceLog_registrationId_idx" ON "ZoomAttendanceLog"("registrationId");

-- CreateIndex
CREATE INDEX "ZoomAttendanceLog_eventId_zoomParticipantId_idx" ON "ZoomAttendanceLog"("eventId", "zoomParticipantId");

-- AddForeignKey
ALTER TABLE "ZoomAttendanceLog" ADD CONSTRAINT "ZoomAttendanceLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoomAttendanceLog" ADD CONSTRAINT "ZoomAttendanceLog_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
