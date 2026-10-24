-- CreateEnum
CREATE TYPE "LibraryLeadKind" AS ENUM ('REGISTRO', 'POSTULACION', 'MARCA', 'CLASE');

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "photoUrl" TEXT,
    "bio" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "instagram" TEXT,
    "tiktok" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "appearances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryVideo" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'video',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'principiante',
    "youtubeId" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "instructorId" TEXT,
    "teachersNote" TEXT,
    "products" JSONB NOT NULL DEFAULT '[]',
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gated" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryVideoDailyView" (
    "videoId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LibraryVideoDailyView_pkey" PRIMARY KEY ("videoId","day")
);

-- CreateTable
CREATE TABLE "InstructorClass" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "place" TEXT NOT NULL,
    "priceLabel" TEXT,
    "url" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryLead" (
    "id" TEXT NOT NULL,
    "kind" "LibraryLeadKind" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "company" TEXT,
    "message" TEXT,
    "instructorId" TEXT,
    "context" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibrarySettings" (
    "id" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "instructorsPublished" BOOLEAN NOT NULL DEFAULT false,
    "texts" JSONB NOT NULL DEFAULT '{}',
    "sections" JSONB NOT NULL DEFAULT '{}',
    "popularSearches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibrarySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instructor_slug_key" ON "Instructor"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryVideo_slug_key" ON "LibraryVideo"("slug");

-- CreateIndex
CREATE INDEX "LibraryVideo_visible_publishedAt_idx" ON "LibraryVideo"("visible", "publishedAt");

-- CreateIndex
CREATE INDEX "InstructorClass_instructorId_startsAt_idx" ON "InstructorClass"("instructorId", "startsAt");

-- CreateIndex
CREATE INDEX "LibraryLead_kind_createdAt_idx" ON "LibraryLead"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "LibraryVideo" ADD CONSTRAINT "LibraryVideo_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryVideoDailyView" ADD CONSTRAINT "LibraryVideoDailyView_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "LibraryVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorClass" ADD CONSTRAINT "InstructorClass_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLead" ADD CONSTRAINT "LibraryLead_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

