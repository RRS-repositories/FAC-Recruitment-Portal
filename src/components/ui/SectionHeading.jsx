import { cn } from '@/utils/cn';
import Reveal from './Reveal';

/**
 * Small uppercase label above a heading.
 *
 * At 12.8px it counts as normal-size text, so it needs 4.5:1: brand gold only
 * clears that on the navy surfaces, hence the tone switch.
 */
export function Eyebrow({ tone = 'light', children, className }) {
  return (
    <p
      className={cn(
        'mb-3 text-[0.8rem] font-semibold uppercase tracking-[0.08em]',
        tone === 'dark' ? 'text-gold' : 'text-gold-deep',
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Eyebrow + heading + supporting line, in the two arrangements the design uses:
 * left-aligned beside a photo, or centred above a grid.
 *
 * `as` keeps the document outline correct — page-level headings pass "h1", the
 * repeated section headings stay at h2.
 */
export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = 'center',
  as: Tag = 'h2',
  tone = 'light',
  className,
  children,
}) {
  const centred = align === 'center';

  return (
    <Reveal className={cn(centred && 'text-center', className)}>
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}

      <Tag
        className={cn(
          'font-display text-display-md',
          tone === 'dark' ? 'text-white' : 'text-navy',
        )}
      >
        {title}
      </Tag>

      {sub ? (
        <p
          className={cn(
            'mt-4 max-w-measure text-[1.05rem] leading-[1.7]',
            centred && 'mx-auto',
            tone === 'dark' ? 'text-white/65' : 'text-muted',
          )}
        >
          {sub}
        </p>
      ) : null}

      {children}
    </Reveal>
  );
}

export default SectionHeading;
