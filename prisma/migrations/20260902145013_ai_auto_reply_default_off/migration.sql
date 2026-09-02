-- AlterTable
ALTER TABLE "WhatsAppConversation" ALTER COLUMN "aiAutoReplyEnabled" SET DEFAULT false;

-- The agent/LLM project itself is on hold for now (2026-09-02) — not just
-- new conversations, every existing thread that inherited the old
-- default=true (or was ever explicitly turned on) goes back to "en manos
-- de un humano" too. WhatsAppAiToggle still lets someone opt a specific
-- thread back in later if that changes.
UPDATE "WhatsAppConversation" SET "aiAutoReplyEnabled" = false;
