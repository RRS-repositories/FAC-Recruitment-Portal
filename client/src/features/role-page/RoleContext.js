import { createContext, useContext } from 'react';

/**
 * The role config (see features/sales/config.js, features/aidev/config.js)
 * for whichever role page is on screen, so the shell and the generic steps
 * can read their brand line, step labels, element-id prefix and copy without
 * every step threading it through.
 */
export const RoleContext = createContext(null);

export function useRoleConfig() {
  const config = useContext(RoleContext);
  if (!config) throw new Error('useRoleConfig must be used inside a role page.');
  return config;
}
