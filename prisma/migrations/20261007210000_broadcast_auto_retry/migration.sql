-- Automatic retry of recoverable failures after a send completes (see schema comments).
ALTER TABLE "WhatsAppBroadcast" ADD COLUMN "autoRetryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailBroadcast" ADD COLUMN "autoRetryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailBroadcast" ADD COLUMN "retryPersonIds" JSONB;
