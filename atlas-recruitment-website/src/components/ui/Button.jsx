import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-brand px-7 py-[15px] text-[0.95rem] font-semibold ' +
  'transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-brand ' +
  'hover:-translate-y-0.5 active:translate-y-0 motion-reduce:hover:translate-y-0 cursor-pointer';

const VARIANTS = {
  // Primary CTA. Navy text on gold clears 4.5:1 comfortably.
  gold: 'bg-gold text-navy hover:bg-gold-light hover:shadow-lift',
  // Secondary CTA sitting on a dark surface.
  ghost: 'border-[1.5px] border-white/35 text-white hover:border-gold hover:text-gold',
  // Same shape, for use on cream/white surfaces.
  ghostDark: 'border-[1.5px] border-navy text-navy hover:border-gold-deep hover:text-gold-deep',
};

/**
 * One button shape, three surfaces. Renders as a router `Link`, a plain anchor
 * or a `<button>` depending on which of `to` / `href` is supplied, so semantics
 * always match behaviour.
 */
export function Button({ variant = 'gold', to, href, className, children, ...props }) {
  const classes = cn(BASE, VARIANTS[variant] ?? VARIANTS.gold, className);

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;
