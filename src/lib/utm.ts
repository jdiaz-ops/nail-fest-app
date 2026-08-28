export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  fbclid?: string;
  ttclid?: string;
  gclid?: string;
}

const KEYS: Record<keyof Attribution, string> = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  fbclid: "fbclid",
  ttclid: "ttclid",
  gclid: "gclid",
};

/** Read once on landing (client-side) and carry through hidden form fields —
 * simplest reliable way to survive the multi-step registration flow without
 * a session store. */
export function attributionFromSearchParams(params: URLSearchParams): Attribution {
  const out: Attribution = {};
  for (const [field, param] of Object.entries(KEYS) as [keyof Attribution, string][]) {
    const value = params.get(param);
    if (value) out[field] = value;
  }
  return out;
}
