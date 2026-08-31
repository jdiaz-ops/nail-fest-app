-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "ticketLinkWhatsAppTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "OrgSettings" ADD CONSTRAINT "OrgSettings_ticketLinkWhatsAppTemplateId_fkey" FOREIGN KEY ("ticketLinkWhatsAppTemplateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
