-- Why a send failed / bounced, from the provider (see schema comment).
ALTER TABLE "EmailLog" ADD COLUMN "errorMessage" TEXT;
