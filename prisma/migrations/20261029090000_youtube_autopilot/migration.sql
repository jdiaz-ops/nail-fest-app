-- The YouTube autopilot (Editar biblioteca → YouTube): Claude reviews the
-- videos brought from the channel and publishes the ones worth it.

-- AlterTable
ALTER TABLE "LibrarySettings" ADD COLUMN     "claudeApiKey" TEXT,
ADD COLUMN     "youtubeAutopilot" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "youtubeAutopilotAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LibraryYoutubeVideo" ADD COLUMN     "aiAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiClaimedAt" TIMESTAMP(3),
ADD COLUMN     "aiError" TEXT,
ADD COLUMN     "aiKeep" BOOLEAN,
ADD COLUMN     "aiProposal" JSONB,
ADD COLUMN     "aiReason" TEXT,
ADD COLUMN     "aiReviewedAt" TIMESTAMP(3),
ADD COLUMN     "decidedBy" TEXT,
ADD COLUMN     "youtubeTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- What the team already decided by hand stays theirs.
UPDATE "LibraryYoutubeVideo" SET "decidedBy" = 'equipo' WHERE status <> 'PENDING';
