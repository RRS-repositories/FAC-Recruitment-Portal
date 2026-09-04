import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import Flag from '@/components/ui/Flag';
import { offices } from '@/data/home';

export function Offices() {
  const { eyebrow, title, sub, footnote, list } = offices;

  return (
    <section id="countries" className="py-16 sm:py-20 lg:py-24">
      <Container>
        <SectionHeading eyebrow={eyebrow} title={title} sub={sub} />

        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {list.map((office, index) => (
            <Reveal
              as="li"
              key={office.city}
              delay={index * 80}
              className="group relative flex h-[300px] items-end overflow-hidden rounded-card text-white sm:h-[340px] xl:h-[380px]"
            >
              <img
                src={office.image}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-brand group-hover:scale-105 motion-reduce:group-hover:scale-100"
              />
              {/* Scrim keeps the caption readable over any photograph. */}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,26,58,0.95)_0%,rgba(12,26,58,0.55)_45%,rgba(12,26,58,0.05)_100%)]" />

              <div className="relative z-10 p-6">
                {/* The flag is decoration; the country name carries the meaning. */}
                <Flag
                  code={office.code}
                  className="mb-2.5 h-5 w-[30px] rounded-[2px] shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
                />
                <h3 className="mb-1.5 font-display text-[1.3rem]">
                  {office.city}
                  <span className="sr-only">, {office.country}</span>
                </h3>
                <p className="text-[0.82rem] leading-[1.55] text-white/80">{office.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>

        <p className="mt-7 text-center text-[0.9rem] text-muted">{footnote}</p>
      </Container>
    </section>
  );
}

export default Offices;
