import ContactSection from '@/components/sections/enquire/ContactSection';
import Faqs from '@/components/sections/enquire/Faqs';
import usePageMeta from '@/hooks/usePageMeta';

export function EnquirePage() {
  usePageMeta({
    title: 'Enquire — Atlas Recruitment',
    description:
      'Tell us the role you need to fill. We reply within one working day with a proposed office, cost band and timeline.',
  });

  return (
    <>
      <ContactSection />
      <Faqs />
    </>
  );
}

export default EnquirePage;
