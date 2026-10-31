"use client";

import { usePathname } from "next/navigation";

// A call to action on Manicuristas Imparables' page. Buying goes to the
// event's one-page checkout (/<event>/checkout, 2026-10-29), taking along the
// visit's own query (its utm_ and fbclid, for the registration's attribution).
// Joining the waiting list goes down to its form: a plain link to
// #lista-de-espera, scrolled smoothly and landing on its first field. On a
// version that sells the ticket levels (lib/imparables/tiers.ts,
// 2026-10-31), buying one goes to the checkout with it: ?tier=circulo.
export default function ImpButton({ action, className, tier, children }: { action: "buy" | "waitlist"; className: string; tier?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  if (action === "buy") {
    const checkout = `${pathname.replace(/\/$/, "")}/checkout`;
    // Without a level, the visit's query exactly as it came (as always).
    const withQuery = (search: string) => {
      if (!tier) return checkout + search;
      const query = new URLSearchParams(search);
      query.set("tier", tier);
      return `${checkout}?${query.toString()}`;
    };
    return (
      <a className={className} href={withQuery("")} onClick={(e) => (e.currentTarget.href = withQuery(window.location.search))}>
        {children}
      </a>
    );
  }
  return (
    <a
      href="#lista-de-espera"
      className={className}
      onClick={(e) => {
        const form = document.getElementById("lista-de-espera");
        if (!form) return;
        e.preventDefault();
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => form.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus({ preventScroll: true }), 500);
      }}
    >
      {children}
    </a>
  );
}
