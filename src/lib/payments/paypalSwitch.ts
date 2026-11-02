/** Whether the checkout offers PayPal (2026-11-02, the team: «esconde la opción de PayPal»). Off: PayPal doesn't take
 * a payment between two Colombian accounts — H la Cosedora SAS's is one, so a buyer from Colombia, with a PayPal
 * account or a card, got PayPal's own error on the first live tries — and no buyer from abroad has paid through it
 * yet. Off, no checkout shows «Dólares · PayPal» (at a stage's USD price or a level's), the server refuses a purchase
 * in dollars, and the admin says a USD price isn't shown. Its credentials, webhook and capture stay as they are, for
 * an order already started. true brings it all back. A module of its own: the admin's client components read it too. */
export const PAYPAL_IN_CHECKOUT = false;
