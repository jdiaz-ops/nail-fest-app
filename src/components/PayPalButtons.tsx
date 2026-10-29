"use client";

import { useEffect, useRef, useState } from "react";

// PayPal's own buttons (its JS SDK, Orders v2) on the one-page checkout
// (components/imparables/ImpCheckout.tsx), for paying in US dollars
// (2026-10-29). Only the public client id reaches the browser: the order is
// created and captured on the server (/api/paypal/orders and its capture),
// through the callbacks the checkout passes in. The SDK's URL is the same for
// sandbox and live — the client id decides which one it runs in.

type PayPalActions = { resolve: () => Promise<void>; reject: () => Promise<void>; restart?: () => Promise<void> };
type PayPalButtonsInstance = { render: (container: HTMLElement) => Promise<void>; close: () => Promise<void> };
interface PayPalNamespace {
  Buttons: (options: Record<string, unknown>) => PayPalButtonsInstance;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

let loading: Promise<PayPalNamespace> | null = null;
let loadedFor: string | null = null;

function loadSdk(clientId: string): Promise<PayPalNamespace> {
  if (window.paypal && loadedFor === clientId) return Promise.resolve(window.paypal);
  if (loading && loadedFor === clientId) return loading;
  loadedFor = clientId;
  loading = new Promise<PayPalNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    script.async = true;
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal's SDK didn't load")));
    script.onerror = () => reject(new Error("Couldn't load PayPal's SDK"));
    document.head.appendChild(script);
  }).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export interface PayPalButtonsProps {
  clientId: string;
  /** Before PayPal's window opens: false keeps it closed (the form has something missing). */
  onClick: () => boolean;
  /** Registers the buyer and asks the server for the order; its id. */
  createOrder: () => Promise<string>;
  /** The buyer approved: capture on the server. `restart` opens PayPal's window again, to pay another way. */
  onApprove: (orderId: string, restart: () => Promise<void>) => Promise<void>;
  onCancel: () => void;
  onError: () => void;
}

export default function PayPalButtons(props: PayPalButtonsProps) {
  const container = useRef<HTMLDivElement>(null);
  // The latest callbacks, without rendering PayPal's buttons again on every keystroke.
  const latest = useRef(props);
  latest.current = props;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let buttons: PayPalButtonsInstance | null = null;
    let gone = false;
    loadSdk(props.clientId)
      .then((paypal) => {
        if (gone || !container.current) return;
        buttons = paypal.Buttons({
          style: { layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 50 },
          onClick: (_data: unknown, actions: PayPalActions) => (latest.current.onClick() ? actions.resolve() : actions.reject()),
          createOrder: () => latest.current.createOrder(),
          onApprove: (data: { orderID: string }, actions: PayPalActions) =>
            latest.current.onApprove(data.orderID, () => actions.restart?.() ?? Promise.resolve()),
          onCancel: () => latest.current.onCancel(),
          onError: () => latest.current.onError(),
        });
        return buttons.render(container.current);
      })
      .catch(() => {
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
      buttons?.close().catch(() => {});
    };
  }, [props.clientId]);

  if (failed) return <p className="imp-co-note is-error">PayPal no cargó. Recarga la página, o paga en pesos con Wompi.</p>;
  return <div ref={container} className="imp-co-paypal" />;
}
