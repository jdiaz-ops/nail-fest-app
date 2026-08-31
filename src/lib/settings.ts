import { db } from "@/lib/db";

export const ORG_SETTINGS_ID = "singleton";

export interface OrgSettingsValue {
  name: string;
  timezone: string;
  language: string;
  replyToEmail: string | null;
  privacyPolicyText: string | null;
  termsAndConditionsText: string | null;
  bannedEmails: string[];
  cookieConsentEnabled: boolean;
  selfServeResendEnabled: boolean;
  confirmationEmailHtml: string | null;
  attachTicketPdf: boolean;
  homepageImageUrl: string | null;
  homepageTagline: string | null;
  homepageCtaLabel: string;
  // See OrgSettings.ticketLinkWhatsAppTemplateId's own schema comment.
  ticketLinkWhatsAppTemplateId: string | null;
}

const DEFAULTS: OrgSettingsValue = {
  name: "Nail Fest",
  timezone: "America/Bogota",
  language: "es",
  replyToEmail: null,
  privacyPolicyText: null,
  termsAndConditionsText: null,
  bannedEmails: [],
  cookieConsentEnabled: false,
  selfServeResendEnabled: true,
  confirmationEmailHtml: null,
  attachTicketPdf: true,
  homepageImageUrl: null,
  homepageTagline: null,
  homepageCtaLabel: "Conseguir entrada gratis",
  ticketLinkWhatsAppTemplateId: null,
};

// No row exists until the first save from /admin/settings — reads never
// create one (a page render shouldn't have a write side effect), so this
// falls back to the same defaults the schema declares.
export async function getOrgSettings(): Promise<OrgSettingsValue> {
  const row = await db.orgSettings.findUnique({ where: { id: ORG_SETTINGS_ID } });
  if (!row) return DEFAULTS;
  return {
    name: row.name,
    timezone: row.timezone,
    language: row.language,
    replyToEmail: row.replyToEmail,
    privacyPolicyText: row.privacyPolicyText,
    termsAndConditionsText: row.termsAndConditionsText,
    bannedEmails: row.bannedEmails,
    cookieConsentEnabled: row.cookieConsentEnabled,
    selfServeResendEnabled: row.selfServeResendEnabled,
    confirmationEmailHtml: row.confirmationEmailHtml,
    attachTicketPdf: row.attachTicketPdf,
    homepageImageUrl: row.homepageImageUrl,
    homepageTagline: row.homepageTagline,
    homepageCtaLabel: row.homepageCtaLabel,
    ticketLinkWhatsAppTemplateId: row.ticketLinkWhatsAppTemplateId,
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
    timezone: row.timezone,
    language: row.language,
    replyToEmail: row.replyToEmail,
    privacyPolicyText: row.privacyPolicyText,
    termsAndConditionsText: row.termsAndConditionsText,
    bannedEmails: row.bannedEmails,
    cookieConsentEnabled: row.cookieConsentEnabled,
    selfServeResendEnabled: row.selfServeResendEnabled,
    confirmationEmailHtml: row.confirmationEmailHtml,
    attachTicketPdf: row.attachTicketPdf,
    homepageImageUrl: row.homepageImageUrl,
    homepageTagline: row.homepageTagline,
    homepageCtaLabel: row.homepageCtaLabel,
    ticketLinkWhatsAppTemplateId: row.ticketLinkWhatsAppTemplateId,
  };
}
