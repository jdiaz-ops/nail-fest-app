-- Rename, not drop+add: this column holds real historical SES message ids
-- used by /api/webhooks/ses's own lookups — a DROP+ADD (Prisma's default
-- diff for this) would silently lose that for every email already sent,
-- so this is a hand-edited RENAME COLUMN instead. See EmailLog.
-- providerMessageId's own schema comment for why the column is renamed
-- at all (Resend as a second provider, see src/lib/email/resend.ts).

-- RenameColumn
ALTER TABLE "EmailLog" RENAME COLUMN "sesMessageId" TO "providerMessageId";

-- RenameIndex
ALTER INDEX "EmailLog_sesMessageId_idx" RENAME TO "EmailLog_providerMessageId_idx";
