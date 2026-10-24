-- The homepage as the community's home (OrgSettings.homepageCommunity),
-- off until the team switches it on in Editar homepage.
ALTER TABLE "OrgSettings" ADD COLUMN     "homepageCommunity" BOOLEAN NOT NULL DEFAULT false;
