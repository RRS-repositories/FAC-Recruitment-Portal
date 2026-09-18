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
 * The application form, one level under the landing page (decided 19 Sep).
 *
 * A child of SALES_PATH on purpose: App.jsx nests it, so the page component
 * stays mounted between the landing and the form, and going back to the
 * landing -- with the browser's Back button too -- never loses what was typed.
 */
export const SALES_APPLY_SEGMENT = 'apply';
export const SALES_APPLY_PATH = `${SALES_PATH}/${SALES_APPLY_SEGMENT}`;

/**
 * Addresses that must keep reaching the sales landing page.
 *
 * `/recruitment/sales` is listed so that links already shared keep working if
 * SALES_PATH moves; the filter drops it while it IS SALES_PATH.
 */
export const SALES_REDIRECTS = ['/recruitment/sales'].filter((path) => path !== SALES_PATH);

/**
 * Addresses that must reach the sales FORM.
 *
 * `/recruitment/apply/sales` is what the generic `/recruitment/apply/:roleKey`
 * route would otherwise match -- and that renders the paralegal-style form,
 * which has no voice note and posts to the wrong endpoint.
 */
export const SALES_APPLY_REDIRECTS = ['/recruitment/apply/sales', '/recruitment/sales/apply'].filter(
  (path) => path !== SALES_APPLY_PATH,
);
