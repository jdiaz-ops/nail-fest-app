-- CreateEnum
CREATE TYPE "InstructorAccessKind" AS ENUM ('RESET', 'INVITE');

-- CreateEnum
CREATE TYPE "InstructorSubmissionStatus" AS ENUM ('PENDING', 'PUBLISHED', 'DECLINED');

-- AlterTable
ALTER TABLE "Instructor" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "invited" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "whatsapp" TEXT,
ADD COLUMN     "youtube" TEXT;

-- AlterTable
ALTER TABLE "LibrarySettings" ADD COLUMN     "portalOpen" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InstructorAccount" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "contentTermsAcceptedAt" TIMESTAMP(3),
    "resetRequestedAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorAccessLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" "InstructorAccessKind" NOT NULL,
    "instructorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorAccessLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorVideoSubmission" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT,
    "products" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "InstructorSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "videoId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorVideoSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstructorAccount_instructorId_key" ON "InstructorAccount"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorAccount_email_key" ON "InstructorAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorSession_tokenHash_key" ON "InstructorSession"("tokenHash");

-- CreateIndex
CREATE INDEX "InstructorSession_accountId_idx" ON "InstructorSession"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorAccessLink_tokenHash_key" ON "InstructorAccessLink"("tokenHash");

-- CreateIndex
CREATE INDEX "InstructorAccessLink_instructorId_idx" ON "InstructorAccessLink"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorVideoSubmission_videoId_key" ON "InstructorVideoSubmission"("videoId");

-- CreateIndex
CREATE INDEX "InstructorVideoSubmission_status_createdAt_idx" ON "InstructorVideoSubmission"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "InstructorAccount" ADD CONSTRAINT "InstructorAccount_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorSession" ADD CONSTRAINT "InstructorSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstructorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorAccessLink" ADD CONSTRAINT "InstructorAccessLink_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorVideoSubmission" ADD CONSTRAINT "InstructorVideoSubmission_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorVideoSubmission" ADD CONSTRAINT "InstructorVideoSubmission_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "LibraryVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The instructors the team already made are approved as they were made.
UPDATE "Instructor" SET "approvedAt" = "createdAt" WHERE "approvedAt" IS NULL;
