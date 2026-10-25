-- The channel's playlists as a clue for the autopilot.

-- AlterTable
ALTER TABLE "LibrarySettings" ADD COLUMN     "youtubePlaylistsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LibraryYoutubeVideo" ADD COLUMN     "youtubePlaylists" TEXT[] DEFAULT ARRAY[]::TEXT[];
