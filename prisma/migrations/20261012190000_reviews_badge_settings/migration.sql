-- Where the reviews badge/block shows on the home and the links page (see OrgSettings schema comments).
ALTER TABLE "OrgSettings" ADD COLUMN "homepageReviews" TEXT NOT NULL DEFAULT 'block';
ALTER TABLE "OrgSettings" ADD COLUMN "homepageReviewsPosition" TEXT NOT NULL DEFAULT 'before_logos';
ALTER TABLE "OrgSettings" ADD COLUMN "linksPageReviewsBadge" BOOLEAN NOT NULL DEFAULT false;
