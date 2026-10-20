-- AlterTable
ALTER TABLE "CuponeraBrand" ADD COLUMN     "freeShippingAllZones" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeShippingFrom" INTEGER;

-- AlterTable
ALTER TABLE "CuponeraProduct" ADD COLUMN     "attributes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "autoSubcategory" TEXT,
ADD COLUMN     "colorFamily" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "line" TEXT,
ADD COLUMN     "nicheCategory" TEXT,
ADD COLUMN     "optionNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ratingAverage" DOUBLE PRECISION,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "size" TEXT,
ADD COLUMN     "soldWithCode" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subcategory" TEXT,
ADD COLUMN     "unitsLeft" INTEGER,
ADD COLUMN     "variant" TEXT,
ADD COLUMN     "variantCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CuponeraSettings" ADD COLUMN     "showBestsellers" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CuponeraCollectionMap" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuponeraCollectionMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuponeraCollectionMap_key_key" ON "CuponeraCollectionMap"("key");


-- The cuponera moves from its first six categories to Marcolini's nine
-- (lib/cuponera/shared.ts): keep what was already picked. Lamps become a
-- subcategory of tools; "geles" and "nailart" become polishes and
-- decoration. Every SET expression reads the row's old values.
UPDATE "CuponeraProduct" SET
  "subcategory" = CASE WHEN "category" = 'lamparas' THEN 'lamparas' ELSE "subcategory" END,
  "category" = CASE "category" WHEN 'geles' THEN 'esmaltes' WHEN 'lamparas' THEN 'herramientas' WHEN 'nailart' THEN 'decoracion' ELSE "category" END,
  "autoSubcategory" = CASE WHEN "autoCategory" = 'lamparas' THEN 'lamparas' ELSE "autoSubcategory" END,
  "autoCategory" = CASE "autoCategory" WHEN 'geles' THEN 'esmaltes' WHEN 'lamparas' THEN 'herramientas' WHEN 'nailart' THEN 'decoracion' ELSE "autoCategory" END;
