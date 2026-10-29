import type { WompiWidgetParams } from "@/lib/payments/wompi";

// Wompi's own payment window (WidgetCheckout), opened over the page — the
// integration Wompi documents for paying from a button of one's own
// (docs.wompi.co/docs/colombia/widget-checkout-web/), and the one
// marcolini.lat uses on the same comercio. The one-page checkout
// (components/imparables/ImpCheckout.tsx) opens it with what /api/register
// signed; if it doesn't load, the checkout falls back to Wompi's page.

type WidgetResult = { transaction?: { id?: string; status?: string } };
type WidgetCheckoutCtor = new (config: Record<string, unknown>) => {
  open: (callback: (result: WidgetResult) => void) => void;
};

declare global {
  interface Window {
    WidgetCheckout?: WidgetCheckoutCtor;
  }
}

const SCRIPT_SRC = "https://checkout.wompi.co/widget.js";
const LOAD_TIMEOUT_MS = 8000;
let loading: Promise<WidgetCheckoutCtor> | null = null;

function loadWidget(): Promise<WidgetCheckoutCtor> {
  if (window.WidgetCheckout) return Promise.resolve(window.WidgetCheckout);
  if (loading) return loading;
  loading = new Promise<WidgetCheckoutCtor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.WidgetCheckout ? resolve(window.WidgetCheckout) : reject(new Error("WidgetCheckout didn't load")));
    script.onerror = () => reject(new Error("Couldn't load Wompi's window"));
    window.setTimeout(() => reject(new Error("Wompi's window took too long")), LOAD_TIMEOUT_MS);
    document.head.appendChild(script);
  }).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

/** Opens Wompi's window. `onDone` gets the transaction's id once one ends (approved or not), or null if the
 * window was closed without paying. False when the window couldn't load at all. */
export async function openWompiWidget(params: WompiWidgetParams, customerData: Record<string, string>, onDone: (transactionId: string | null) => void): Promise<boolean> {
  let Widget: WidgetCheckoutCtor;
  try {
    Widget = await loadWidget();
  } catch {
    return false;
  }
  const checkout = new Widget({
    currency: params.currency,
    amountInCents: params.amountInCents,
    reference: params.reference,
    publicKey: params.publicKey,
    signature: { integrity: params.signature },
    redirectUrl: params.redirectUrl,
    customerData,
  });
  checkout.open((result) => onDone(result?.transaction?.id ?? null));
  return true;
}
