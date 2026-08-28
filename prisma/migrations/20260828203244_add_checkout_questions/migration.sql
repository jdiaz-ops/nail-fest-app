-- CreateEnum
CREATE TYPE "CheckoutQuestionType" AS ENUM ('TEXT', 'RADIO');

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Bogota';

-- CreateTable
CREATE TABLE "CheckoutQuestion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CheckoutQuestionType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutQuestion_key_key" ON "CheckoutQuestion"("key");

-- CreateIndex
CREATE INDEX "CheckoutQuestion_order_idx" ON "CheckoutQuestion"("order");
