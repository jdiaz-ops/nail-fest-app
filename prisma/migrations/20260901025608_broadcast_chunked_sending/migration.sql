-- AlterTable
ALTER TABLE "EmailBroadcast" ADD COLUMN     "cursor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recipientPersonIds" JSONB;

-- AlterTable
ALTER TABLE "WhatsAppBroadcast" ADD COLUMN     "cursor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recipientPersonIds" JSONB;
