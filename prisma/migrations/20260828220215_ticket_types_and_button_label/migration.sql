-- CreateEnum
CREATE TYPE "TicketTypeStatus" AS ENUM ('ON_SALE', 'HIDDEN', 'ACCESS_CODE_REQUIRED', 'SOLD_OUT', 'UNAVAILABLE', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "TicketIssuance" AS ENUM ('INDIVIDUAL', 'GROUP');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "registerButtonLabel" TEXT;

-- CreateTable
CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "bookingFee" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" "TicketTypeStatus" NOT NULL DEFAULT 'ON_SALE',
    "minPerOrder" INTEGER NOT NULL DEFAULT 1,
    "maxPerOrder" INTEGER NOT NULL DEFAULT 20,
    "issuance" "TicketIssuance" NOT NULL DEFAULT 'INDIVIDUAL',
    "hideUntil" TIMESTAMP(3),
    "hideAfter" TIMESTAMP(3),
    "hideWhenSoldOut" BOOLEAN NOT NULL DEFAULT false,
    "showRemainingOnPage" BOOLEAN NOT NULL DEFAULT false,
    "excludeFromLowestPrice" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketType_eventId_idx" ON "TicketType"("eventId");

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
