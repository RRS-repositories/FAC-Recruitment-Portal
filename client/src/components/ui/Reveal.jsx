import { cn } from '@/lib/cn';
import { useInView } from '@/hooks/useInView';

/**
 * Fades and lifts children in the first time they scroll into view.
 *
 * The transition lives in CSS (.reveal), so reduced-motion users get the
 * content with no movement and no JS branch is needed here. `delay` staggers
 * siblings in a grid — used sparingly: the guidance is one or two animated
 * elements per view, not everything at once.
 */
export function Reveal({ as: Tag = 'div', delay = 0, className, children, ...props }) {
  const [ref, inView] = useInView();

  return (
    <Tag
      ref={ref}
      data-visible={inView ? 'true' : 'false'}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      className={cn('reveal', className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
