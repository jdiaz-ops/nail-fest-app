import { db } from "@/lib/db";

/** Internal, staff-only note on a conversation — never sent to WhatsApp.
 * See WhatsAppNote's own schema comment. */
export async function addNote(conversationId: string, authorId: string | null, text: string) {
  return db.whatsAppNote.create({ data: { conversationId, authorId, text } });
}
