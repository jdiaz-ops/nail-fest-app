-- The team's YouTube channel brought into the library (Editar biblioteca →
-- YouTube, 2026-10-25): the channel and its key in the library's settings,
-- and each video of it to review.

-- AlterTable
ALTER TABLE "LibrarySettings" ADD COLUMN     "youtubeApiKey" TEXT,
ADD COLUMN     "youtubeChannel" TEXT,
ADD COLUMN     "youtubeChannelId" TEXT,
ADD COLUMN     "youtubeChannelTitle" TEXT,
ADD COLUMN     "youtubeImportedAt" TIMESTAMP(3),
ADD COLUMN     "youtubeUploadsId" TEXT;

-- CreateTable
CREATE TABLE "LibraryYoutubeVideo" (
    "id" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER,
    "views" INTEGER NOT NULL DEFAULT 0,
    "privacy" TEXT NOT NULL DEFAULT 'public',
    "short" BOOLEAN NOT NULL DEFAULT false,
    "suggestedTheme" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "libraryVideoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryYoutubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryYoutubeVideo_youtubeId_key" ON "LibraryYoutubeVideo"("youtubeId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryYoutubeVideo_libraryVideoId_key" ON "LibraryYoutubeVideo"("libraryVideoId");

-- CreateIndex
CREATE INDEX "LibraryYoutubeVideo_status_views_idx" ON "LibraryYoutubeVideo"("status", "views");

-- AddForeignKey
ALTER TABLE "LibraryYoutubeVideo" ADD CONSTRAINT "LibraryYoutubeVideo_libraryVideoId_fkey" FOREIGN KEY ("libraryVideoId") REFERENCES "LibraryVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

