-- The top of the front page is the panel with each brand as a coupon
-- (chosen on 2026-10-20), for new installs and for the page as it is.
ALTER TABLE "CuponeraSettings" ALTER COLUMN "heroStyle" SET DEFAULT 'cupones';
UPDATE "CuponeraSettings" SET "heroStyle" = 'cupones';
