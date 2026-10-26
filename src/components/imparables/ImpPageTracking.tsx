"use client";

import { useEffect } from "react";
import { ensureFbcCookie, track, waitForFbpCookie } from "@/components/tracking";

// PageView and ViewContent for Manicuristas Imparables' page while no
// price is on sale (waiting list, sale closed): with one on sale the
// checkout (EventRegistration) fires them itself — same order, same wait
// for the Pixel's cookie.
export default function ImpPageTracking() {
  useEffect(() => {
    (async () => {
      await waitForFbpCookie();
      ensureFbcCookie();
      track("PageView");
      track("ViewContent");
    })();
  }, []);
  return null;
}
