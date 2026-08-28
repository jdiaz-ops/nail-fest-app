-- CreateEnum
CREATE TYPE "NameFormat" AS ENUM ('FULL', 'FIRST_LAST');

-- AlterTable
ALTER TABLE "CheckoutQuestion" ADD COLUMN     "confirmEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameFormat" "NameFormat" NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "ProfessionOption" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;
