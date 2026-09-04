import Container from '@/components/ui/Container';
import { clientLogos } from '@/components/ui/ClientLogoMarks';
import { logoStripHeading } from '@/data/home';

/**
 * One full pass of the logos.
 *
 * The trailing padding matches the inter-logo gap, which makes each row exactly
 * half the track's width — that is what lets `translateX(-50%)` loop with no
 * visible jump at the seam.
 */
function LogoRow({ ariaHidden = false }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-12 pr-12 sm:gap-[70px] sm:pr-[70px]">
      {clientLogos.map(({ id, name, Mark }) => (
        <div key={id} className="flex h-14 flex-shrink-0 items-center">
          <Mark
            className="h-14 w-auto"
            role={ariaHidden ? undefined : 'img'}
            aria-label={ariaHidden ? undefined : name}
            aria-hidden={ariaHidden ? 'true' : undefined}
            focusable="false"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Infinite client-logo strip. The second row is aria-hidden so each client is
 * announced once. Hover pauses the animation, and reduced-motion stops it
 * entirely (see `styles/index.css`), leaving a legible static row.
 */
export function LogoMarquee() {
  return (
    <section aria-label="Client companies" className="border-b border-hairline bg-cream py-11">
      <Container>
        <p className="mb-6 text-center text-[0.82rem] font-medium text-muted">
          {logoStripHeading}
        </p>
      </Container>

      <div className="marquee-mask group relative overflow-hidden">
        <div className="flex w-max animate-marquee py-1 group-hover:[animation-play-state:paused]">
          <LogoRow />
          <LogoRow ariaHidden />
        </div>
      </div>
    </section>
  );
}

export default LogoMarquee;
