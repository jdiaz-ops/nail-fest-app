import { db } from "@/lib/db";

export const ORG_SETTINGS_ID = "singleton";

export interface OrgSettingsValue {
  name: string;
  replyToEmail: string | null;
  privacyPolicyText: string | null;
  bannedEmails: string[];
  cookieConsentEnabled: boolean;
  selfServeResendEnabled: boolean;
}

const DEFAULTS: OrgSettingsValue = {
  name: "Nail Fest",
  replyToEmail: null,
  privacyPolicyText: null,
  bannedEmails: [],
  cookieConsentEnabled: false,
  selfServeResendEnabled: true,
};

// No row exists until the first save from /admin/settings — reads never
// create one (a page render shouldn't have a write side effect), so this
// falls back to the same defaults the schema declares.
export async function getOrgSettings(): Promise<OrgSettingsValue> {
  const row = await db.orgSettings.findUnique({ where: { id: ORG_SETTINGS_ID } });
  if (!row) return DEFAULTS;
  return {
    name: row.name,
    replyToEmail: row.replyToEmail,
    privacyPolicyText: row.privacyPolicyText,
    bannedEmails: row.bannedEmails,
    cookieConsentEnabled: row.cookieConsentEnabled,
    selfServeResendEnabled: row.selfServeResendEnabled,
  };
}

export async function updateOrgSettings(patch: Partial<OrgSettingsValue>): Promise<OrgSettingsValue> {
  const row = await db.orgSettings.upsert({
    where: { id: ORG_SETTINGS_ID },
    create: { id: ORG_SETTINGS_ID, ...DEFAULTS, ...patch },
    update: patch,
  });
  return {
    name: row.name,
    replyToEmail: row.replyToEmail,
    privacyPolicyText: row.privacyPolicyText,
    bannedEmails: row.bannedEmails,
    cookieConsentEnabled: row.cookieConsentEnabled,
    selfServeResendEnabled: row.selfServeResendEnabled,
  };
}
