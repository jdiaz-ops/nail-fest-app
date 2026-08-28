import Script from "next/script";

/**
 * The actual browser Meta Pixel — closes the `_fbp` gap CAPI-only can't
 * (see tracking.ts's ensureFbcCookie() comment): `_fbp` is a random
 * per-browser ID only the Pixel's own JS generates, nothing server-side
 * can construct it. Also gives Meta the richer real-time browser signal
 * (device/viewport/etc.) their ad algorithm uses alongside CAPI.
 *
 * Every event this Pixel fires is DEDUPLICATED against the matching
 * server-side CAPI event via a shared `eventID` — see tracking.ts's
 * track() and RegistrationForm.tsx's Purchase call. Firing both without
 * a shared eventID would double-count every conversion; Meta explicitly
 * documents eventID as the fix, not "pick one or the other."
 * https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events
 *
 * Renders nothing if no pixelId is configured yet (Meta not connected —
 * see /admin/meta) — CAPI-only keeps working exactly as before either way.
 */
export default function MetaPixelScript({ pixelId }: { pixelId: string | null }) {
  if (!pixelId) return null;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
