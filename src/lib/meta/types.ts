export type MetaStandardEventName =
  | "PageView"
  | "ViewContent"
  | "InitiateCheckout"
  | "Purchase";

export interface MetaUserData {
  email?: string;
  phone?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  /** Meta browser click-id cookie (_fbc) — captured client-side from fbclid. */
  fbc?: string;
  /** Meta browser id cookie (_fbp). */
  fbp?: string;
}

export interface MetaCustomData {
  value?: number;
  currency?: string;
}

export interface SendMetaEventInput {
  /** Shared with the browser Pixel call (if any) for CAPI dedup. */
  eventId: string;
  eventName: MetaStandardEventName;
  eventSourceUrl: string;
  userData: MetaUserData;
  customData?: MetaCustomData;
  registrationId?: string;
}
