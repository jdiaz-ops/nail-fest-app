-- «Versiones de la landing» (2026-10-30): another link to an event's page —
-- nailfest.lat/v/<slug> — with its own cover and an optional special price.
-- A new table, and a nullable link to it on the page's views, registrations
-- and payments; nothing existing changes.

-- AlterTable
ALTER TABLE "LandingView" ADD COLUMN     "landingVersionId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "landingVersionId" TEXT;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "landingVersionId" TEXT;

-- CreateTable
CREATE TABLE "LandingVersion" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "title" TEXT,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "buttonLabel" TEXT,
    "specialPrices" JSONB,
    "priceLabel" TEXT,
    "maxSpecialSales" INTEGER,
    "checkoutOpenedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandingVersion_slug_key" ON "LandingVersion"("slug");

-- CreateIndex
CREATE INDEX "LandingVersion_eventId_idx" ON "LandingVersion"("eventId");

-- CreateIndex
CREATE INDEX "LandingView_landingVersionId_idx" ON "LandingView"("landingVersionId");

-- CreateIndex
CREATE INDEX "Payment_landingVersionId_idx" ON "Payment"("landingVersionId");

-- CreateIndex
CREATE INDEX "Registration_landingVersionId_idx" ON "Registration"("landingVersionId");

-- AddForeignKey
ALTER TABLE "LandingView" ADD CONSTRAINT "LandingView_landingVersionId_fkey" FOREIGN KEY ("landingVersionId") REFERENCES "LandingVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_landingVersionId_fkey" FOREIGN KEY ("landingVersionId") REFERENCES "LandingVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_landingVersionId_fkey" FOREIGN KEY ("landingVersionId") REFERENCES "LandingVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingVersion" ADD CONSTRAINT "LandingVersion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

