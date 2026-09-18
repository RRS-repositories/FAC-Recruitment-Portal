/**
 * The applicants list, one role at a time.
 *
 * `/admin` is the whole list. Each role also has its own address,
 * `/admin/applicants/<role key>`, which opens the same page with that role's
 * filter already applied — a link in the admin menu per role. Nothing here
 * decides what a role is: the list comes from `ROLES`, so a new role gets its
 * menu entry and its address without an edit to this file.
 *
 * Pure, with no imports, so it can be tested under plain `node --test` —
 * `data/roles.js` pulls in images, which node cannot load. Callers pass
 * `ROLES` in.
 */

/** The applicants page: every role. Unchanged, and still the default. */
export const APPLICANTS_PATH = '/admin';

/** Where the per-role views live. */
export const ROLE_APPLICANTS_BASE = '/admin/applicants';

/** The address that shows `roleKey`'s applicants; 'all' (or nothing) is `/admin`. */
export const applicantsPathFor = (roleKey) =>
  !roleKey || roleKey === 'all' ? APPLICANTS_PATH : `${ROLE_APPLICANTS_BASE}/${roleKey}`;

/**
 * The URL's role, if it names one. Anything else is null, never trusted as a
 * filter — an unknown key would otherwise reach the API as "all roles" while
 * the page claimed to be showing one.
 */
export const routeRoleKey = (roles, param) =>
  param && Object.prototype.hasOwnProperty.call(roles, param) ? param : null;

/** The role's short name for the menu: `navName`, falling back to the job title. */
const navNameOf = (role) => role.navName ?? role.title;

/** "South Africa – Sales": country first, because two roles share one. */
export const roleNavLabel = (role) => `${role.country} – ${navNameOf(role)}`;

/** The line on the page's header band: "South Africa · Sales applicants". */
export const roleHeading = (role) => `${role.country} · ${navNameOf(role)} applicants`;

/** One menu entry per role, in `ROLES` order. */
export const roleNavItems = (roles) =>
  Object.values(roles).map((role) => ({
    key: role.key,
    to: applicantsPathFor(role.key),
    label: roleNavLabel(role),
  }));
