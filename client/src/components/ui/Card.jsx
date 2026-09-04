import { cn } from '@/lib/cn';

/**
 * The surface everything sits on. Border, radius and shadow are spent here
 * once rather than stamped on every block — so when something DOES need to
 * stand out, it still can.
 */
export function Card({ as: Tag = 'div', padded = true, className, children, ...props }) {
  return (
    <Tag
      className={cn('rounded-card bg-white shadow-card', padded && 'p-6 sm:p-8', className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

export default Card;
