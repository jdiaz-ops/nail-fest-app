-- Additive only: two new optional homepage sections below the hero.
ALTER TABLE "OrgSettings" ADD COLUMN "homepageGalleryImageUrls" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "OrgSettings" ADD COLUMN "homepageBrandLogos" JSONB NOT NULL DEFAULT '[]';
