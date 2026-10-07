-- One invocation at a time per broadcast send (see schema comments).
ALTER TABLE "EmailBroadcast" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "WhatsAppBroadcast" ADD COLUMN "lockedUntil" TIMESTAMP(3);
