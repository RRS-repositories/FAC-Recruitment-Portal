/**
 * Joins class names, dropping falsy values.
 *
 * Deliberately dependency-free: the components here compose classes but never
 * need to *resolve* conflicting Tailwind utilities, so `clsx` + `tailwind-merge`
 * would be two dependencies earning nothing.
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default cn;
