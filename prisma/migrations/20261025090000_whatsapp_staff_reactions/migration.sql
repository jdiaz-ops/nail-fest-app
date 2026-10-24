-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN     "staffReaction" TEXT,
ADD COLUMN     "staffReactionProviderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_staffReactionProviderId_key" ON "WhatsAppMessage"("staffReactionProviderId");
