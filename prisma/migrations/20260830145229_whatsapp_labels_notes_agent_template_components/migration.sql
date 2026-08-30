-- CreateEnum
CREATE TYPE "WhatsAppTemplateHeaderType" AS ENUM ('NONE', 'TEXT');

-- AlterTable
ALTER TABLE "WhatsAppBroadcast" ADD COLUMN     "assignLabelId" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppConversation" ADD COLUMN     "assignedToId" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppTemplate" ADD COLUMN     "buttons" JSONB,
ADD COLUMN     "footerText" TEXT,
ADD COLUMN     "headerText" TEXT,
ADD COLUMN     "headerType" "WhatsAppTemplateHeaderType" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "WhatsAppNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LabelToPerson" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "WhatsAppNote_conversationId_createdAt_idx" ON "WhatsAppNote"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Label_name_key" ON "Label"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_LabelToPerson_AB_unique" ON "_LabelToPerson"("A", "B");

-- CreateIndex
CREATE INDEX "_LabelToPerson_B_index" ON "_LabelToPerson"("B");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_assignedToId_idx" ON "WhatsAppConversation"("assignedToId");

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcast" ADD CONSTRAINT "WhatsAppBroadcast_assignLabelId_fkey" FOREIGN KEY ("assignLabelId") REFERENCES "Label"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppNote" ADD CONSTRAINT "WhatsAppNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppNote" ADD CONSTRAINT "WhatsAppNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LabelToPerson" ADD CONSTRAINT "_LabelToPerson_A_fkey" FOREIGN KEY ("A") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LabelToPerson" ADD CONSTRAINT "_LabelToPerson_B_fkey" FOREIGN KEY ("B") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
