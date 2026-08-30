-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "homepageCtaLabel" TEXT NOT NULL DEFAULT 'Conseguir entrada gratis',
ADD COLUMN     "homepageImageUrl" TEXT,
ADD COLUMN     "homepageTagline" TEXT;

