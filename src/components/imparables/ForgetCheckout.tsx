"use client";

import { useEffect } from "react";
import { forgetCheckoutMemory } from "@/lib/imparables/checkoutMemory";

// Her payment is confirmed: what the checkout remembered of her in this
// browser (lib/imparables/checkoutMemory.ts) isn't needed any more.
export default function ForgetCheckout({ eventSlug }: { eventSlug: string }) {
  useEffect(() => {
    forgetCheckoutMemory(eventSlug);
  }, [eventSlug]);
  return null;
}
