"use client";

// A call to action on Manicuristas Imparables' page. Buying opens the
// checkout — EventRegistration (layout "modal") listens for the same
// nailfest:open-registration event the other events' cover image sends.
// Joining the waiting list goes down to its form: a plain link to
// #lista-de-espera, scrolled smoothly and landing on its first field.
export default function ImpButton({ action, className, children }: { action: "buy" | "waitlist"; className: string; children: React.ReactNode }) {
  if (action === "buy") {
    return (
      <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("nailfest:open-registration"))}>
        {children}
      </button>
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
