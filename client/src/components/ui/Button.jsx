import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold ' +
  'transition-[background,color,border-color,transform,box-shadow] duration-200 ease-brand ' +
  'disabled:cursor-not-allowed disabled:opacity-60 ' +
  // Every control clears 44px so it is comfortably tappable.
  'min-h-[44px] cursor-pointer active:translate-y-px motion-reduce:active:translate-y-0';

const VARIANTS = {
  primary: 'bg-cta text-white shadow-cta hover:brightness-110 disabled:hover:brightness-100',
  secondary: 'border-[1.5px] border-line bg-white text-ink hover:border-violet hover:text-violet-deep',
  ghost: 'border border-white/20 bg-white/10 text-white hover:bg-white/20',
  quiet: 'text-violet-deep hover:bg-lav-soft',
  danger: 'border-[1.5px] border-line bg-white text-danger hover:border-danger',
};

const SIZES = {
  sm: 'px-4 py-2 text-[0.85rem]',
  md: 'px-6 py-3 text-[0.95rem]',
  lg: 'px-8 py-3.5 text-base',
};

/**
 * One button, rendered as a router Link, an anchor or a <button> depending on
 * which of `to`/`href` is supplied — so the semantics always match what the
 * control actually does, and a link stays a link for keyboard and middle-click.
 */
export function Button({ variant = 'primary', size = 'md', to, href, className, children, ...props }) {
  const classes = cn(BASE, VARIANTS[variant] ?? VARIANTS.primary, SIZES[size], className);

  if (to) return <Link to={to} className={classes} {...props}>{children}</Link>;
  if (href) return <a href={href} className={classes} {...props}>{children}</a>;
  return <button type="button" className={classes} {...props}>{children}</button>;
}

export default Button;
