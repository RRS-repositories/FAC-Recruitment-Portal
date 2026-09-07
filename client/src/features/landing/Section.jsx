import { cn } from '@/lib/cn';

/**
 * A page section with consistent padding and an optional tint.
 *
 * Alternating tints do the work that borders otherwise would — the eye reads
 * a change of ground as a change of subject without needing a rule drawn.
 */
export function Section({ id, tone = 'plain', className, children }) {
  const tones = {
    plain: 'bg-canvas',
    white: 'bg-white',
    tint: 'bg-lav-soft',
    brand: 'hero-glow relative overflow-hidden bg-brand text-white',
  };

  return (
    <section id={id} className={cn('scroll-mt-8 px-5 py-16 sm:px-8 lg:py-24', tones[tone], className)}>
      <div className={cn('mx-auto max-w-shell', tone === 'brand' && 'relative z-10')}>{children}</div>
    </section>
  );
}

export default Section;
