-- Each video's picture: upright (9:16) or lying (16:9), as YouTube says.
-- AlterTable
ALTER TABLE "LibraryVideo" ADD COLUMN     "vertical" BOOLEAN;

-- AlterTable
ALTER TABLE "LibraryYoutubeVideo" ADD COLUMN     "vertical" BOOLEAN;
