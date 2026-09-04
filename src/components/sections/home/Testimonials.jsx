import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { testimonials } from '@/data/home';

/** Five gold stars — one accessible label rather than five repeated glyphs. */
function Stars() {
  return (
    <div className="mb-4 text-[0.9rem] tracking-[2px] text-gold-deep">
      <span aria-hidden="true">★★★★★</span>
      <span className="sr-only">Rated 5 out of 5</span>
    </div>
  );
}

export function Testimonials() {
  const { eyebrow, title, items, feature } = testimonials;

  return (
    <section id="clients" className="bg-cream py-16 sm:py-20 lg:py-24">
      <Container>
        <SectionHeading eyebrow={eyebrow} title={title} />

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <Reveal
              key={item.organisation}
              delay={index * 100}
              className="flex flex-col rounded-card border border-hairline bg-white px-7 py-8 transition-shadow duration-300 hover:shadow-lift"
            >
              <Stars />
              <blockquote className="flex-1 text-[0.97rem] leading-[1.7] text-ink">
                {item.quote}
              </blockquote>
              <footer className="mt-6 flex items-center gap-3 border-t border-hairline pt-5">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-navy text-[0.8rem] font-bold text-gold"
                >
                  {item.initials}
                </span>
                <span>
                  <b className="block text-[0.88rem] text-navy">{item.role}</b>
                  <small className="text-[0.76rem] text-muted">{item.organisation}</small>
                </span>
              </footer>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-5 grid overflow-hidden rounded-card bg-navy text-white lg:grid-cols-2">
          <img
            src={feature.image}
            alt={feature.alt}
            loading="lazy"
            decoding="async"
            className="h-64 w-full object-cover sm:h-80 lg:h-full lg:min-h-[320px]"
          />
          <div className="flex flex-col justify-center px-7 py-10 sm:px-11 sm:py-12">
            <blockquote className="mb-6 font-display text-[1.2rem] leading-[1.5] sm:text-[1.35rem]">
              {feature.quote}
            </blockquote>
            <b className="text-[0.9rem] text-gold">{feature.role}</b>
            <small className="block text-[0.8rem] text-white/60">{feature.organisation}</small>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export default Testimonials;
