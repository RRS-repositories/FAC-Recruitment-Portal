import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import Button from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/SectionHeading';
import { founderStory } from '@/data/founder';
import { useInView } from '@/hooks/useInView';
import { useCountUp } from '@/hooks/useCountUp';

function StoryStat({ value, label, active }) {
  const display = useCountUp(value, active);

  return (
    <div className="rounded-[10px] bg-cream p-5 text-center">
      <b className="block font-display text-[2rem] leading-tight text-navy tabular-nums">
        {display}
      </b>
      <small className="text-[0.75rem] text-muted">{label}</small>
    </div>
  );
}

export function FounderStory() {
  const { eyebrow, title, paragraphs, emphasis, quote, stats } = founderStory;
  const [statsRef, statsInView] = useInView({ threshold: 0.35 });

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <Container>
        <div className="mx-auto max-w-prose">
          <Reveal>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="text-display-md text-navy">{title}</h2>
          </Reveal>

          <Reveal delay={80}>
            {paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-5 text-[1.05rem] leading-[1.8] text-ink">
                {paragraph}
              </p>
            ))}

            <p className="mt-5 text-[1.05rem] leading-[1.8] text-ink">
              <strong className="font-semibold text-navy">{emphasis.strong}</strong>
              {emphasis.rest}
            </p>
          </Reveal>

          <Reveal
            as="figure"
            delay={80}
            className="my-9 rounded-card bg-navy px-8 py-7 text-white"
          >
            <blockquote className="font-display text-[1.2rem] leading-[1.5] sm:text-[1.3rem]">
              “{quote.text}”
            </blockquote>
            <figcaption className="mt-3.5 text-[0.85rem] text-gold">
              {quote.attribution}
            </figcaption>
          </Reveal>

          <div ref={statsRef} className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {stats.map((stat) => (
              <StoryStat key={stat.label} {...stat} active={statsInView} />
            ))}
          </div>

          <div className="mt-9 flex flex-wrap gap-3.5">
            <Button to="/enquire" variant="gold">
              Enquire now
            </Button>
            <Button to={{ pathname: '/', hash: '#benefits' }} variant="ghostDark">
              Why offshore?
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default FounderStory;
