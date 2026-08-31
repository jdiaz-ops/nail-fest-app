-- AlterTable
ALTER TABLE "WhatsAppConversation" ADD COLUMN     "aiAutoReplyEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN     "generatedByAi" BOOLEAN NOT NULL DEFAULT false;
