/**
 * How long each free-text field may be, matched to its column.
 *
 * A module of its own, with no imports, so the role folders (./sales/,
 * ./aidev/) can check a city's length without importing validate.js --
 * validate.js imports roles.js, roles.js imports the extended-role registry,
 * and the registry imports those folders. Reaching back into validate.js from
 * there would close that loop into an import cycle.
 *
 * validate.js re-exports this same object, so every existing caller is
 * unchanged.
 */
export const FIELD_LIMITS = {
  fullName: 120,
  email: 254,
  phone: 40,
  city: 120,
  written: 4000,
};
