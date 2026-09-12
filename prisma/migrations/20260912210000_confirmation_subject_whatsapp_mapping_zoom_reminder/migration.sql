-- Event.confirmationEmailSubject / OrgSettings.confirmationEmailSubject —
-- the subject line was hardcoded in code until now; see each column's own
-- schema comment for the fallback chain.
ALTER TABLE "Event" ADD COLUMN "confirmationEmailSubject" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "confirmationEmailSubject" TEXT;

-- WhatsAppAutomation.variableMapping — see the column's own schema
-- comment: replaces the old fixed "[firstName, eventName]" convention
-- with the same {slot: mergeTagKey} mapping WhatsAppBroadcast already
-- uses. Null (every existing row) keeps the old fixed convention.
ALTER TABLE "WhatsAppAutomation" ADD COLUMN "variableMapping" JSONB;

-- ZOOM_ACCESS_REMINDER — a new trigger value, not a new table.
ALTER TYPE "WhatsAppAutomationTrigger" ADD VALUE 'ZOOM_ACCESS_REMINDER';
