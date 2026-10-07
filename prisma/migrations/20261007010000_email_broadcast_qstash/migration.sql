-- Exact-time send for event email broadcasts (see EmailBroadcast.qstashMessageId).
ALTER TABLE "EmailBroadcast" ADD COLUMN "qstashMessageId" TEXT;
