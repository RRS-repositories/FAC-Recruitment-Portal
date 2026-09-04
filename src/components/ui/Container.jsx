import { cn } from '@/utils/cn';

/**
 * The single page gutter. Every section uses it, so horizontal rhythm is
 * defined in exactly one place.
 */
export function Container({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={cn('mx-auto w-full max-w-wrap px-5 sm:px-6', className)} {...props}>
      {children}
    </Tag>
  );
}

export default Container;
