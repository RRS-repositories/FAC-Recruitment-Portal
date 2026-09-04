import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import Icon from '@/components/ui/Icon';
import SectionHeading from '@/components/ui/SectionHeading';
import { whyAtlas } from '@/data/home';

export function WhyAtlas() {
  const { eyebrow, title, sub, cards } = whyAtlas;

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <Container>
        <SectionHeading eyebrow={eyebrow} title={title} sub={sub} />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {cards.map((card, index) => (
            <Reveal
              key={card.title}
              delay={index * 90}
              className="group rounded-card border border-hairline px-7 py-8 transition-[border-color,box-shadow,transform] duration-300 ease-brand hover:-translate-y-1 hover:border-gold/40 hover:shadow-lift motion-reduce:hover:translate-y-0"
            >
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/[0.14] text-gold transition-colors duration-300 group-hover:bg-gold/25">
                <Icon name={card.icon} />
              </span>
              <h3 className="mb-2 text-[1.05rem] font-bold text-navy">{card.title}</h3>
              <p className="text-[0.9rem] text-muted">{card.body}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

export default WhyAtlas;
