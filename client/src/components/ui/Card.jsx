import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * The surface everything sits on. Border, radius and shadow are spent here
 * once rather than stamped on every block — so when something DOES need to
 * stand out, it still can.
 *
 * Forwards its ref because a dialog has to be able to focus its own panel and
 * ask what is focusable inside it. Every existing caller is unaffected.
 */
export const Card = forwardRef(function Card(
  { as: Tag = 'div', padded = true, className, children, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cn('rounded-card bg-white shadow-card', padded && 'p-6 sm:p-8', className)}
      {...props}
    >
      {children}
    </Tag>
  );
});

export default Card;
