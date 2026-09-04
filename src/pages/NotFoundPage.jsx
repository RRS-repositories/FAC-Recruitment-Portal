import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import usePageMeta from '@/hooks/usePageMeta';

export function NotFoundPage() {
  usePageMeta({
    title: 'Page not found — Atlas Recruitment',
    description: 'The page you were looking for has moved or no longer exists.',
  });

  return (
    <section className="bg-cream pb-24 pt-40">
      <Container className="text-center">
        <p className="mb-3 text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-gold-deep">
          Error 404
        </p>
        <h1 className="text-display-lg text-navy">This page has moved on.</h1>
        <p className="mx-auto mt-5 max-w-measure text-[1.05rem] text-muted">
          The link you followed doesn&rsquo;t lead anywhere any more. Head back to the homepage, or
          tell us the role you need and we&rsquo;ll take it from there.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3.5">
          <Button to="/" variant="gold">
            Back to homepage
          </Button>
          <Button to="/enquire" variant="ghostDark">
            Enquire now
          </Button>
        </div>
      </Container>
    </section>
  );
}

export default NotFoundPage;
