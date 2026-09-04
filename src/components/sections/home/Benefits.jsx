import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import Icon from '@/components/ui/Icon';
import SectionHeading from '@/components/ui/SectionHeading';
import { benefits } from '@/data/home';

export function Benefits() {
  const { eyebrow, title, sub, cards, list } = benefits;

  return (
    <section id="benefits" className="border-t border-hairline bg-white py-16 sm:py-20 lg:py-24">
      <Container>
        <SectionHeading eyebrow={eyebrow} title={title} sub={sub} />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map((card, index) => (
            <Reveal
              key={card.title}
              delay={index * 90}
              className="group rounded-card bg-navy px-7 py-8 text-white transition-transform duration-300 ease-brand hover:-translate-y-1 motion-reduce:hover:translate-y-0"
            >
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/[0.18] text-gold transition-colors duration-300 group-hover:bg-gold/30">
                <Icon name={card.icon} />
              </span>
              <h3 className="mb-2 font-display text-[1.3rem] text-gold">{card.title}</h3>
              <p className="text-[0.9rem] text-white/75">{card.body}</p>
            </Reveal>
          ))}
        </div>

        <div className="mt-5 grid gap-[18px] md:grid-cols-2">
          {list.map((item, index) => (
            <Reveal
              key={item.title}
              delay={index * 70}
              className="rounded-[10px] border border-hairline border-l-4 border-l-gold bg-cream px-6 py-6 transition-shadow duration-300 hover:shadow-lift"
            >
              <b className="mb-1.5 block text-base text-navy">{item.title}</b>
              <p className="text-[0.88rem] text-muted">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

export default Benefits;
