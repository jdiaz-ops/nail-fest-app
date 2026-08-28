import { headers } from "next/headers";

export function clientIpFromHeaders(): string | undefined {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return h.get("x-real-ip") ?? undefined;
}

export function userAgentFromHeaders(): string | undefined {
  return headers().get("user-agent") ?? undefined;
}
