import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import Button from '@/components/ui/Button';
import { ctaBand } from '@/data/home';

export function CtaBand() {
  return (
    <section className="border-t border-hairline bg-cream py-16 sm:py-20 lg:py-24">
      <Container>
        <Reveal className="text-center">
          <h2 className="text-display-md text-navy">{ctaBand.title}</h2>
          <p className="mx-auto mt-4 max-w-measure text-[1.05rem] leading-[1.7] text-muted">
            {ctaBand.sub}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3.5">
            <Button to="/enquire" variant="gold">
              Enquire now
            </Button>
            <Button to="/founder" variant="ghostDark">
              Meet the founder
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export default CtaBand;
