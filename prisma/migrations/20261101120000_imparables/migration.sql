-- Manicuristas Imparables' own page (2026-10-26): how an event's public page
-- looks, and Meta's Lead event for its waiting list. Both additive: every
-- existing event keeps NAIL_FEST, its page exactly as it was.
CREATE TYPE "EventTheme" AS ENUM ('NAIL_FEST', 'IMPARABLES');
ALTER TABLE "Event" ADD COLUMN "theme" "EventTheme" NOT NULL DEFAULT 'NAIL_FEST';
ALTER TYPE "MetaEventName" ADD VALUE 'Lead';
