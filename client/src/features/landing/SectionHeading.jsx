import { Reveal } from '@/components/ui/Reveal';
import { cn } from '@/lib/cn';

/**
 * Eyebrow + heading + supporting line. Every section uses it, so the vertical
 * rhythm of the page is decided once rather than re-tuned per section.
 */
export function SectionHeading({ eyebrow, title, sub, align = 'center', className }) {
  const centred = align === 'center';
  return (
    <Reveal className={cn(centred && 'text-center', className)}>
      {eyebrow ? (
        <p className="mb-3 text-[0.76rem] font-bold uppercase tracking-[0.13em] text-violet-deep">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-display-lg font-extrabold tracking-tight text-ink">{title}</h2>
      {sub ? (
        <p className={cn('mt-4 max-w-2xl text-[1.02rem] leading-relaxed text-muted', centred && 'mx-auto')}>
          {sub}
        </p>
      ) : null}
    </Reveal>
  );
}

export default SectionHeading;
