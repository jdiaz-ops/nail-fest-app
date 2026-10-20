// What a code is good for — asked on 2026-10-21: only in the online store
// its link opens, never in a shop, with a distributor or anywhere else.
export const CODES_ONLY_ONLINE_LEAD = "Los códigos de la cuponera solo sirven en la tienda en línea a la que te lleva cada link.";
export const CODES_ONLY_ONLINE_REST = "No aplican en tiendas físicas, con distribuidores ni en otros canales de venta.";
export const CODES_ONLY_ONLINE = `${CODES_ONLY_ONLINE_LEAD} ${CODES_ONLY_ONLINE_REST}`;

// The cuponera's footer, the band that closes every page: where the codes
// work (first, set apart), how buying works and who's behind the stores. No
// links — the only way out of the cuponera is a store.
export default function CuponeraFooter() {
  return (
    <footer className="cup-footer">
      <div className="cup-footer-inner">
        <span className="cup-brand cup-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
          <img src="/logo.png" alt="Nail Fest" />
          <span>Cuponera</span>
        </span>
        <div className="cup-footer-codes">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z" />
            <path d="M9.5 14.5 14.5 9.5M9.5 9.5h.01M14.5 14.5h.01" />
          </svg>
          <p>
            <b>{CODES_ONLY_ONLINE_LEAD}</b> {CODES_ONLY_ONLINE_REST}
          </p>
        </div>
        <p className="cup-footer-small">
          Cada compra se hace en la tienda de la marca, con sus precios y condiciones. Nail Fest recibe una comisión por las compras hechas desde la
          cuponera.
        </p>
        <span className="cup-footer-tech">Tiendas con tecnología Marcolini</span>
      </div>
    </footer>
  );
}
