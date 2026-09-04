import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { howItWorks } from '@/data/home';

export function HowItWorks() {
  const { eyebrow, title, sub, steps } = howItWorks;

  return (
    <section id="how" className="bg-navy py-16 text-white sm:py-20 lg:py-24">
      <Container>
        <SectionHeading eyebrow={eyebrow} title={title} sub={sub} tone="dark" />

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Reveal
              as="li"
              key={step.number}
              delay={index * 110}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-7 transition-colors duration-300 hover:border-gold/40 hover:bg-white/[0.08]"
            >
              <b className="mb-3.5 block font-display text-[2.2rem] leading-none text-gold">
                {step.number}
              </b>
              <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
              <p className="text-[0.86rem] text-white/65">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

export default HowItWorks;
