-- AlterTable
ALTER TABLE "CuponeraSettings" ADD COLUMN     "allBrandsSubtitle" TEXT,
ADD COLUMN     "allBrandsTitle" TEXT,
ADD COLUMN     "bestsellersSubtitle" TEXT,
ADD COLUMN     "bestsellersTitle" TEXT,
ADD COLUMN     "categoriesTitle" TEXT,
ADD COLUMN     "panelTitle" TEXT,
ADD COLUMN     "showAllBrands" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showCategories" BOOLEAN NOT NULL DEFAULT true;
