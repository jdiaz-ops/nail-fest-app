// What a code is good for — asked on 2026-10-21: only in the online store
// its link opens, never in a shop, with a distributor or anywhere else.
export const CODES_ONLY_ONLINE =
  "Los códigos de la cuponera solo sirven en la tienda en línea a la que te lleva cada link. No aplican en tiendas físicas, con distribuidores ni en otros canales de venta.";

// The cuponera's footer: where the codes work, how buying works and who's
// behind the stores. No links — the only way out of the cuponera is a store.
export default function CuponeraFooter() {
  return (
    <footer className="cup-footer">
      <div className="cup-footer-text">
        <p className="cup-footer-codes">{CODES_ONLY_ONLINE}</p>
        <p>Cada compra se hace en la tienda de la marca, con sus precios y condiciones. Nail Fest recibe una comisión por las compras hechas desde la cuponera.</p>
      </div>
      <span className="cup-footer-tech">Tiendas con tecnología Marcolini</span>
    </footer>
  );
}
