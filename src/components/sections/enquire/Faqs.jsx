import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { faqs } from '@/data/enquire';

export function Faqs() {
  return (
    <section aria-label="Frequently asked questions" className="pb-16 pt-16 sm:pb-20 lg:pb-24">
      <Container>
        <dl className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq, index) => (
            <Reveal
              key={faq.question}
              delay={(index % 2) * 80}
              className="rounded-[10px] border border-hairline px-6 py-5 transition-[border-color,box-shadow] duration-300 hover:border-gold/40 hover:shadow-lift"
            >
              <dt className="mb-1.5 font-semibold text-navy">{faq.question}</dt>
              <dd className="text-[0.88rem] text-muted">{faq.answer}</dd>
            </Reveal>
          ))}
        </dl>
      </Container>
    </section>
  );
}

export default Faqs;
