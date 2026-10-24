-- The privacy policy's community part (/privacidad): null = the usual text
-- (lib/communityPrivacy.ts).
ALTER TABLE "OrgSettings" ADD COLUMN     "communityPrivacyText" TEXT;
