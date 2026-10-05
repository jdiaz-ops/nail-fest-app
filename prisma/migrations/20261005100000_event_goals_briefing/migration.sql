-- Decision targets per event (see Event.goalRegistrations & co.) and the
-- weekly briefing recipients (OrgSettings.briefingEmails).
ALTER TABLE "Event" ADD COLUMN "goalRegistrations" INTEGER;
ALTER TABLE "Event" ADD COLUMN "goalAttendance" INTEGER;
ALTER TABLE "Event" ADD COLUMN "referenceEventId" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "briefingEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
