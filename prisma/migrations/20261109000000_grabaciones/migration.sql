-- Manicuristas Imparables' recordings (the team, 2026-11-04): one YouTube link per talk, pasted in the admin
-- («Grabaciones») and played on each buyer's own page («Tu congreso»). Nothing in it until the team pastes them.
ALTER TABLE "Event" ADD COLUMN "recordings" JSONB;
