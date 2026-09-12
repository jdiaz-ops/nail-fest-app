"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches this server component's data every 15s while the page is
// open — same idea as the door-scanner's own live panel, just simpler
// (no live socket, a plain re-render is plenty for "how many are
// connected right now" during a few-hour event). Stops re-fetching the
// moment the admin navigates away (the effect's own cleanup).
export default function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
