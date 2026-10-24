-- The community's accounts and the Consultorio (nailfest.lat/cuenta,
-- nailfest.lat/consultorio, 2026-10-24), and its switch — off until the
-- team publishes it.

-- CreateEnum
CREATE TYPE "ConsultorioAuthor" AS ENUM ('MEMBER', 'INSTRUCTOR', 'TEAM');

-- AlterTable
ALTER TABLE "LibrarySettings" ADD COLUMN     "consultorioPublished" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CommunityMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "resetRequestedAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "personId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunitySession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunitySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityAccessLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityAccessLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultorioQuestion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "authorKind" "ConsultorioAuthor" NOT NULL,
    "memberId" TEXT,
    "instructorId" TEXT,
    "adminUserId" TEXT,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "photoUrl" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "bestAnswerId" TEXT,
    "answerCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultorioQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultorioAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorKind" "ConsultorioAuthor" NOT NULL,
    "memberId" TEXT,
    "instructorId" TEXT,
    "adminUserId" TEXT,
    "body" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "usefulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultorioAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultorioVote" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "memberId" TEXT,
    "instructorId" TEXT,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultorioVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_email_key" ON "CommunityMember"("email");

-- CreateIndex
CREATE INDEX "CommunityMember_personId_idx" ON "CommunityMember"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunitySession_tokenHash_key" ON "CommunitySession"("tokenHash");

-- CreateIndex
CREATE INDEX "CommunitySession_memberId_idx" ON "CommunitySession"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityAccessLink_tokenHash_key" ON "CommunityAccessLink"("tokenHash");

-- CreateIndex
CREATE INDEX "CommunityAccessLink_memberId_idx" ON "CommunityAccessLink"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultorioQuestion_slug_key" ON "ConsultorioQuestion"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultorioQuestion_bestAnswerId_key" ON "ConsultorioQuestion"("bestAnswerId");

-- CreateIndex
CREATE INDEX "ConsultorioQuestion_hidden_lastActivityAt_idx" ON "ConsultorioQuestion"("hidden", "lastActivityAt");

-- CreateIndex
CREATE INDEX "ConsultorioQuestion_memberId_idx" ON "ConsultorioQuestion"("memberId");

-- CreateIndex
CREATE INDEX "ConsultorioQuestion_instructorId_idx" ON "ConsultorioQuestion"("instructorId");

-- CreateIndex
CREATE INDEX "ConsultorioAnswer_questionId_hidden_idx" ON "ConsultorioAnswer"("questionId", "hidden");

-- CreateIndex
CREATE INDEX "ConsultorioAnswer_memberId_idx" ON "ConsultorioAnswer"("memberId");

-- CreateIndex
CREATE INDEX "ConsultorioAnswer_instructorId_idx" ON "ConsultorioAnswer"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultorioVote_answerId_memberId_key" ON "ConsultorioVote"("answerId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultorioVote_answerId_instructorId_key" ON "ConsultorioVote"("answerId", "instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultorioVote_answerId_adminUserId_key" ON "ConsultorioVote"("answerId", "adminUserId");

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunitySession" ADD CONSTRAINT "CommunitySession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CommunityMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAccessLink" ADD CONSTRAINT "CommunityAccessLink_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CommunityMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioQuestion" ADD CONSTRAINT "ConsultorioQuestion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CommunityMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioQuestion" ADD CONSTRAINT "ConsultorioQuestion_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioQuestion" ADD CONSTRAINT "ConsultorioQuestion_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioQuestion" ADD CONSTRAINT "ConsultorioQuestion_bestAnswerId_fkey" FOREIGN KEY ("bestAnswerId") REFERENCES "ConsultorioAnswer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioAnswer" ADD CONSTRAINT "ConsultorioAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ConsultorioQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioAnswer" ADD CONSTRAINT "ConsultorioAnswer_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CommunityMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioAnswer" ADD CONSTRAINT "ConsultorioAnswer_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioAnswer" ADD CONSTRAINT "ConsultorioAnswer_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioVote" ADD CONSTRAINT "ConsultorioVote_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ConsultorioAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioVote" ADD CONSTRAINT "ConsultorioVote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CommunityMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioVote" ADD CONSTRAINT "ConsultorioVote_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultorioVote" ADD CONSTRAINT "ConsultorioVote_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

