-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Nail Fest',
    "replyToEmail" TEXT,
    "privacyPolicyText" TEXT,
    "bannedEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cookieConsentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "selfServeResendEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("id")
);
