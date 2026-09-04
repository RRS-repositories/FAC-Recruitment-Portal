import { Link } from 'react-router-dom';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import { Eyebrow } from '@/components/ui/SectionHeading';
import EnquiryForm from './EnquiryForm';
import { enquireIntro } from '@/data/enquire';
import { company } from '@/data/company';

function InfoBlock({ heading, children }) {
  return (
    <div className="mt-6 first:mt-0">
      <h2 className="mb-1.5 font-sans text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-gold">
        {heading}
      </h2>
      <p className="text-[0.95rem] text-white/80">{children}</p>
    </div>
  );
}

const linkClass =
  'font-medium text-white no-underline transition-colors duration-200 hover:text-gold';

export function ContactSection() {
  return (
    <section
      id="contact"
      className="bg-[linear-gradient(160deg,#0c1a3a,#1c2f58)] pb-16 pt-28 text-white sm:pb-20 lg:pb-24 lg:pt-[150px]"
    >
      <Container>
        <Eyebrow tone="dark">{enquireIntro.eyebrow}</Eyebrow>
        <h1 className="text-display-md text-white">{enquireIntro.title}</h1>
        <p className="mt-4 max-w-measure text-[1.05rem] leading-[1.7] text-white/65">
          {enquireIntro.sub}
        </p>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-[60px]">
          <Reveal>
            <InfoBlock heading="Phone">
              <a href={company.phoneHref} className={linkClass}>
                {company.phone}
              </a>
            </InfoBlock>

            <InfoBlock heading="WhatsApp">
              <Link to="/" className={linkClass}>
                Message us on WhatsApp
              </Link>
            </InfoBlock>

            <InfoBlock heading="Email">
              <a href={company.emailHref} className={linkClass}>
                {company.email}
              </a>
            </InfoBlock>

            <InfoBlock heading="Head office">{company.headOffice}</InfoBlock>
            <InfoBlock heading="Overseas offices">{company.overseasOffices}</InfoBlock>
          </Reveal>

          <Reveal delay={100}>
            <EnquiryForm />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

export default ContactSection;
