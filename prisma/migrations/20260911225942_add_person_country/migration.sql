-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "country" TEXT;

-- CreateIndex
CREATE INDEX "Person_country_idx" ON "Person"("country");
