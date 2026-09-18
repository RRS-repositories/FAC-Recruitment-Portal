/**
 * Where the Sales & Customer Service (South Africa) page lives.
 *
 * THE ONLY PLACE THIS URL IS WRITTEN. App.jsx routes it, the home page card
 * links to it, and the redirects below point at it — so moving the page is a
 * one-line change here.
 *
 * Kept free of imports so the router can read it without pulling the page's
 * lazy chunk (or its stylesheet) into the main bundle.
 */
export const SALES_PATH = '/recruitment/sales';

/**
 * Addresses that must keep reaching the sales page.
 *
 * `/recruitment/apply/sales` is what the generic `/recruitment/apply/:roleKey`
 * route would otherwise match — and that renders the paralegal-style form,
 * which has no voice note and posts to the wrong endpoint. `/recruitment/sales`
 * is listed so that links already shared keep working if SALES_PATH moves;
 * the filter drops whichever entry SALES_PATH currently is.
 */
export const SALES_REDIRECTS = ['/recruitment/apply/sales', '/recruitment/sales'].filter(
  (path) => path !== SALES_PATH,
);
