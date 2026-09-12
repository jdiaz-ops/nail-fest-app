-- Registration.zoomJoinUrl — persists what used to be an in-memory-only
-- value (generated once at confirmation time, only ever handed to
-- sendTicketEmail) so /[eventSlug]/pago's own return-page render can show
-- the same personal Zoom link too, not just the confirmation email.
ALTER TABLE "Registration" ADD COLUMN "zoomJoinUrl" TEXT;

-- AutomationFormatScope — see WhatsAppAutomation's own schema comment for
-- why this exists: a WhatsApp template's body is fixed/pre-approved by
-- Meta, so "adapt per event format" means picking between up to two
-- approved templates per trigger, not conditionally rendering one.
CREATE TYPE "AutomationFormatScope" AS ENUM ('DEFAULT', 'VIRTUAL');

ALTER TABLE "WhatsAppAutomation" ADD COLUMN "formatScope" "AutomationFormatScope" NOT NULL DEFAULT 'DEFAULT';

-- Every existing row is now (trigger, DEFAULT) — still one per trigger,
-- so this drop+recreate is safe against current data (no duplicates
-- possible until an admin deliberately adds a VIRTUAL override).
DROP INDEX "WhatsAppAutomation_trigger_key";
CREATE UNIQUE INDEX "WhatsAppAutomation_trigger_formatScope_key" ON "WhatsAppAutomation"("trigger", "formatScope");
