import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { Eyebrow } from '@/components/ui/SectionHeading';
import { founderHero } from '@/data/founder';

export function FounderHero() {
  const { eyebrow, title, lead, portrait } = founderHero;

  return (
    <section className="bg-cream pb-16 pt-28 sm:pb-20 lg:pb-24 lg:pt-[150px]">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="text-display-lg text-navy">{title}</h1>
          <p className="mt-5 max-w-[520px] text-[1.1rem] text-muted">{lead}</p>
        </div>

        <Reveal delay={100} className="relative overflow-hidden rounded-card shadow-card">
          <img
            src={portrait.image}
            alt={portrait.alt}
            decoding="async"
            className="h-[380px] w-full object-cover object-top sm:h-[460px] lg:h-[560px]"
          />
          <p className="absolute inset-x-0 bottom-0 bg-navy px-5 py-3 text-[0.75rem] uppercase tracking-[0.08em] text-gold">
            {portrait.caption}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

export default FounderHero;
