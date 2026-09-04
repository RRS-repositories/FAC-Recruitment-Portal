import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { industries } from '@/data/home';

export function Industries() {
  const { eyebrow, title, sub, featured, more } = industries;

  return (
    <section id="industries" className="bg-cream py-16 sm:py-20 lg:py-24">
      <Container>
        <SectionHeading eyebrow={eyebrow} title={title} sub={sub} />

        <ul className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.map((item, index) => (
            <Reveal
              as="li"
              key={item.title}
              // Stagger across the row, not the whole grid, so later rows still
              // animate promptly when they scroll in.
              delay={(index % 4) * 80}
              className="group overflow-hidden rounded-xl border border-hairline bg-white transition-[transform,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:shadow-lift motion-reduce:hover:translate-y-0"
            >
              <div className="overflow-hidden">
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-[130px] w-full object-cover transition-transform duration-500 ease-brand group-hover:scale-105 motion-reduce:group-hover:scale-100 sm:h-[150px]"
                />
              </div>
              <div className="px-5 pb-5 pt-4">
                <h3 className="mb-1 text-[0.95rem] font-bold text-navy">{item.title}</h3>
                <p className="text-[0.8rem] text-muted">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {more.map((item, index) => (
            <Reveal
              as="li"
              key={item}
              delay={(index % 4) * 60}
              className="flex items-center gap-2.5 rounded-brand border border-hairline bg-white px-4 py-3.5 text-[0.88rem] font-semibold text-navy transition-colors duration-200 hover:border-gold/50"
            >
              <span aria-hidden="true" className="h-2 w-2 flex-shrink-0 rounded-full bg-gold" />
              {item}
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export default Industries;
