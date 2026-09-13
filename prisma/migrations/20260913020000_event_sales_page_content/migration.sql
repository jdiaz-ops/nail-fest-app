-- Event.salesPageContent — structured content for a richer sales-script
-- landing (hero/story/value-stack table/schedule/speakers/FAQ), as an
-- alternative rendering path to the plain rich-text `description`. Purely
-- additive and nullable: every existing event has NULL here and keeps
-- rendering through `description` exactly as before — see the column's
-- own schema comment for the full reasoning.
ALTER TABLE "Event" ADD COLUMN "salesPageContent" JSONB;
