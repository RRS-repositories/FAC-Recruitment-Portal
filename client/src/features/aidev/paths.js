/**
 * Where the AI Developer (India, remote) page lives.
 *
 * THE ONLY PLACE THIS URL IS WRITTEN. App.jsx routes it, the home page card
 * links to it, and the redirects below point at it — so moving the page is a
 * one-line change here.
 *
 * Kept free of imports so the router can read it without pulling the page's
 * lazy chunk (or its stylesheet) into the main bundle.
 */
export const AIDEV_PATH = '/recruitment/ai-developer';

/**
 * The application form, one level under the landing page, as sales has it.
 *
 * A child of AIDEV_PATH on purpose: App.jsx nests it, so the page component
 * stays mounted between the landing and the form, and going back to the
 * landing -- with the browser's Back button too -- never loses what was typed.
 */
export const AIDEV_APPLY_SEGMENT = 'apply';
export const AIDEV_APPLY_PATH = `${AIDEV_PATH}/${AIDEV_APPLY_SEGMENT}`;

/**
 * Addresses that must keep reaching the AI developer landing page.
 *
 * `/recruitment/ai-developer` is listed so that links already shared keep
 * working if AIDEV_PATH moves; the filter drops it while it IS AIDEV_PATH.
 */
export const AIDEV_REDIRECTS = ['/recruitment/ai-developer'].filter((path) => path !== AIDEV_PATH);

/**
 * Addresses that must reach the AI developer FORM.
 *
 * `/recruitment/apply/ai-developer` is what the generic
 * `/recruitment/apply/:roleKey` route would otherwise match -- and that
 * renders the paralegal-style form, which has none of this role's questions
 * and posts to the wrong endpoint.
 */
export const AIDEV_APPLY_REDIRECTS = [
  '/recruitment/apply/ai-developer',
  '/recruitment/ai-developer/apply',
].filter((path) => path !== AIDEV_APPLY_PATH);
