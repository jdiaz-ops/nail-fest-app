-- CreateTable
CREATE TABLE "CuponeraBrand" (
    "id" TEXT NOT NULL,
    "marcoliniId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "storeUrl" TEXT,
    "storeKind" TEXT NOT NULL,
    "codeAppliedByLink" BOOLEAN NOT NULL DEFAULT false,
    "discountCode" TEXT NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "commissionPercent" DECIMAL(5,2) NOT NULL,
    "campaign" JSONB,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "showCoupon" BOOLEAN NOT NULL DEFAULT true,
    "couponTitle" TEXT,
    "couponConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "couponExclusive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuponeraBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuponeraProduct" (
    "id" TEXT NOT NULL,
    "marcoliniId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "priceMax" INTEGER,
    "compareAtPrice" INTEGER,
    "url" TEXT NOT NULL,
    "sourceCategory" TEXT,
    "collections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" TEXT NOT NULL DEFAULT 'PHYSICAL',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "marcoliniCreatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "autoCategory" TEXT,
    "professions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isNew" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuponeraProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuponeraSettings" (
    "id" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "heroTitle" TEXT,
    "heroLede" TEXT,
    "showDeal" BOOLEAN NOT NULL DEFAULT true,
    "showCoupons" BOOLEAN NOT NULL DEFAULT true,
    "showNew" BOOLEAN NOT NULL DEFAULT true,
    "newTitle" TEXT,
    "newSubtitle" TEXT,
    "newDays" INTEGER NOT NULL DEFAULT 30,
    "dealProductId" TEXT,
    "dealEndsAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncOk" BOOLEAN,
    "lastSyncError" TEXT,
    "lastSyncBrands" INTEGER,
    "lastSyncProducts" INTEGER,
    "creatorName" TEXT,
    "creatorSlug" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuponeraSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuponeraBrand_marcoliniId_key" ON "CuponeraBrand"("marcoliniId");

-- CreateIndex
CREATE UNIQUE INDEX "CuponeraProduct_marcoliniId_key" ON "CuponeraProduct"("marcoliniId");

-- CreateIndex
CREATE INDEX "CuponeraProduct_brandId_idx" ON "CuponeraProduct"("brandId");

-- AddForeignKey
ALTER TABLE "CuponeraProduct" ADD CONSTRAINT "CuponeraProduct_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "CuponeraBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

