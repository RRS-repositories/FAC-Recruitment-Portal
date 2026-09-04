import FounderHero from '@/components/sections/founder/FounderHero';
import FounderStory from '@/components/sections/founder/FounderStory';
import usePageMeta from '@/hooks/usePageMeta';

export function FounderPage() {
  usePageMeta({
    title: 'Meet the founder — Atlas Recruitment',
    description:
      'Brad Forbes built Atlas out of running his own managed teams across India, South Africa, Dubai and the Philippines.',
  });

  return (
    <>
      <FounderHero />
      <FounderStory />
    </>
  );
}

export default FounderPage;
