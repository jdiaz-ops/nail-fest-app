import { db } from "@/lib/db";

export const ORG_SETTINGS_ID = "singleton";

// OrgSettings.homepageBrandLogos is stored as Json (Prisma.JsonValue) —
// this is the one place that trusts it back into the real shape, rather
// than every reader re-guessing it. Malformed/legacy data reads as
// empty, never throws — same "never let a bad DB value break a page
// render" posture as everything else reading OrgSettings.
function parseBrandLogos(value: unknown): { url: string; name: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is { url: string; name: string } =>
      typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).url === "string" && typeof (v as Record<string, unknown>).name === "string"
  );
}

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
  confirmationEmailSubject: string | null;
  attachTicketPdf: boolean;
  // Microsoft Clarity project id (see /admin/settings/analytics) — null
  // means the script is never injected (today's behavior).
  clarityProjectId: string | null;
  homepageImageUrl: string | null;
  homepageVideoUrl: string | null;
  homepageTagline: string | null;
  homepageCtaLabel: string;
  homepageGalleryImageUrls: string[];
  homepageBrandLogos: { url: string; name: string }[];
  homepageBrandLogosTitle: string | null;
  homepageClosingText: string | null;
  linksPageImageUrl: string | null;
  linksPageVideoUrl: string | null;
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
  confirmationEmailSubject: null,
  attachTicketPdf: true,
  clarityProjectId: null,
  homepageImageUrl: null,
  homepageVideoUrl: null,
  homepageTagline: null,
  homepageCtaLabel: "Conseguir entrada gratis",
  homepageGalleryImageUrls: [],
  homepageBrandLogos: [],
  homepageBrandLogosTitle: null,
  homepageClosingText: null,
  linksPageImageUrl: null,
  linksPageVideoUrl: null,
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
    confirmationEmailSubject: row.confirmationEmailSubject,
    attachTicketPdf: row.attachTicketPdf,
    clarityProjectId: row.clarityProjectId,
    homepageImageUrl: row.homepageImageUrl,
    homepageVideoUrl: row.homepageVideoUrl,
    homepageTagline: row.homepageTagline,
    homepageCtaLabel: row.homepageCtaLabel,
    homepageGalleryImageUrls: row.homepageGalleryImageUrls,
    homepageBrandLogos: parseBrandLogos(row.homepageBrandLogos),
    homepageBrandLogosTitle: row.homepageBrandLogosTitle,
    homepageClosingText: row.homepageClosingText,
    linksPageImageUrl: row.linksPageImageUrl,
    linksPageVideoUrl: row.linksPageVideoUrl,
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
    confirmationEmailSubject: row.confirmationEmailSubject,
    attachTicketPdf: row.attachTicketPdf,
    clarityProjectId: row.clarityProjectId,
    homepageImageUrl: row.homepageImageUrl,
    homepageVideoUrl: row.homepageVideoUrl,
    homepageTagline: row.homepageTagline,
    homepageCtaLabel: row.homepageCtaLabel,
    homepageGalleryImageUrls: row.homepageGalleryImageUrls,
    homepageBrandLogos: parseBrandLogos(row.homepageBrandLogos),
    homepageBrandLogosTitle: row.homepageBrandLogosTitle,
    homepageClosingText: row.homepageClosingText,
    linksPageImageUrl: row.linksPageImageUrl,
    linksPageVideoUrl: row.linksPageVideoUrl,
  };
}
