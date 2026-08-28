-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
