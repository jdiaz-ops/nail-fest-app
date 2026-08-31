/*
  Warnings:

  - You are about to drop the column `ticketLinkWhatsAppTemplateId` on the `OrgSettings` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "WhatsAppAutomationTrigger" AS ENUM ('REGISTRATION_CONFIRMED');

-- DropForeignKey
ALTER TABLE "OrgSettings" DROP CONSTRAINT "OrgSettings_ticketLinkWhatsAppTemplateId_fkey";

-- AlterTable
ALTER TABLE "OrgSettings" DROP COLUMN "ticketLinkWhatsAppTemplateId";

-- CreateTable
CREATE TABLE "WhatsAppAutomation" (
    "id" TEXT NOT NULL,
    "trigger" "WhatsAppAutomationTrigger" NOT NULL,
    "templateId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAutomation_trigger_key" ON "WhatsAppAutomation"("trigger");

-- AddForeignKey
ALTER TABLE "WhatsAppAutomation" ADD CONSTRAINT "WhatsAppAutomation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
