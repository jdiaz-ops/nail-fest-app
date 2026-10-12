-- Sample reviews an admin can create to see the blocks, visible only to logged-in staff (see schema comment).
ALTER TABLE "Review" ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;
