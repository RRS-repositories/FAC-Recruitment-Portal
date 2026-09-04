import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import Icon from '@/components/ui/Icon';
import { Eyebrow } from '@/components/ui/SectionHeading';
import { whatWeDo } from '@/data/home';

export function WhatWeDo() {
  const { eyebrow, title, sub, checks, photo } = whatWeDo;

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-display-md text-navy">{title}</h2>
          <p className="mt-4 max-w-measure text-[1.05rem] leading-[1.7] text-muted">{sub}</p>

          <ul className="mt-7 grid gap-3.5">
            {checks.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[0.95rem]">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-gold text-navy"
                >
                  <Icon name="check" size={13} strokeWidth={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="relative overflow-hidden rounded-card shadow-card">
          <img
            src={photo.image}
            alt={photo.alt}
            loading="lazy"
            decoding="async"
            className="h-[340px] w-full object-cover sm:h-[420px] lg:h-[480px]"
          />

          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-[10px] bg-white p-3.5 shadow-tag sm:right-auto sm:max-w-[85%]">
            <span
              aria-hidden="true"
              className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-gold text-navy"
            >
              <Icon name="headset" size={18} strokeWidth={2} />
            </span>
            <span>
              <b className="block text-[0.85rem] text-navy">{photo.tagTitle}</b>
              <small className="text-[0.75rem] leading-snug text-muted">{photo.tagSub}</small>
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export default WhatWeDo;
