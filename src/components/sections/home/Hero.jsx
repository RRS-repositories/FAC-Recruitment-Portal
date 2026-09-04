import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import { hero } from '@/data/home';
import images from '@/data/images';
import { useInView } from '@/hooks/useInView';
import { useCountUp } from '@/hooks/useCountUp';

function MiniStat({ value, label, active }) {
  const display = useCountUp(value, active);

  return (
    <div className="rounded-md bg-cream px-2.5 py-3 text-center">
      <b className="block font-display text-[1.5rem] leading-tight text-navy tabular-nums">
        {display}
      </b>
      <small className="text-[0.7rem] leading-tight text-muted">{label}</small>
    </div>
  );
}

export function Hero() {
  const [statsRef, statsInView] = useInView({ threshold: 0.4 });

  return (
    <header className="relative flex min-h-[88vh] items-center overflow-hidden bg-navy pb-16 pt-28 text-white sm:pb-20 lg:pb-[90px] lg:pt-[130px]">
      {/* Background photograph, held behind a gradient scrim heavy enough for
          the headline to clear contrast on every screen width. */}
      <div className="absolute inset-0">
        <img
          src={images.img01}
          alt=""
          aria-hidden="true"
          // Lowercase: React 18 passes unknown lowercase attributes straight
          // through, whereas `fetchPriority` would be dropped with a warning.
          fetchpriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-navy/95 lg:bg-[linear-gradient(100deg,rgba(12,26,58,0.97)_0%,rgba(12,26,58,0.9)_50%,rgba(12,26,58,0.6)_100%)]"
        />
      </div>

      <Container className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-[60px]">
        <div>
          <h1 className="animate-fade-in-down text-display-xl">
            {hero.headline} <span className="text-gold">{hero.headlineAccent}</span>
          </h1>

          <p className="mt-6 max-w-[520px] text-[1.05rem] text-white/[0.78] sm:text-[1.15rem]">
            {hero.lead}
          </p>

          <div className="mt-8 flex flex-wrap gap-3.5">
            <Button to="/enquire" variant="gold">
              Enquire now
            </Button>
            <Button to={{ pathname: '/', hash: '#benefits' }} variant="ghost">
              Why offshore?
            </Button>
          </div>

          <p className="mt-10 text-[0.85rem] text-white/65">
            <b className="font-semibold text-white">{hero.trust.strong}</b> {hero.trust.rest}
          </p>
        </div>

        <div
          ref={statsRef}
          className="overflow-hidden rounded-card bg-white text-ink shadow-hero"
        >
          <img
            src={hero.card.image}
            alt={hero.card.alt}
            width="640"
            height="260"
            decoding="async"
            className="h-[220px] w-full object-cover sm:h-[260px]"
          />
          <div className="px-6 py-6">
            <h2 className="mb-3.5 font-sans text-[0.95rem] font-bold text-navy">
              {hero.card.title}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {hero.card.stats.map((stat) => (
                <MiniStat key={stat.label} {...stat} active={statsInView} />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </header>
  );
}

export default Hero;
