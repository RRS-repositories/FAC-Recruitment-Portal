import { Link } from 'react-router-dom';
import Container from '@/components/ui/Container';
import Logo from '@/components/ui/Logo';
import { footerNav } from '@/data/navigation';
import { company } from '@/data/company';

function targetFor({ to, hash }) {
  return hash ? { pathname: to, hash: `#${hash}` } : { pathname: to };
}

export function Footer() {
  return (
    <footer className="bg-navy-deep pb-8 pt-16 text-white/70">
      <Container>
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-11">
          <div>
            <Logo />
            <p className="mt-4 max-w-[300px] text-[0.86rem] leading-[1.7] text-white/55">
              {company.footerBlurb}
            </p>
          </div>

          {footerNav.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="mb-3.5 font-sans text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-white/55">
                {column.heading}
              </h2>
              <ul className="space-y-1">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={targetFor(link)}
                      className="inline-block py-1 text-[0.88rem] text-white/70 no-underline transition-colors duration-200 hover:text-gold"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-11 flex flex-col gap-2 border-t border-white/[0.08] pt-6 text-center text-[0.78rem] text-white/55 sm:flex-row sm:justify-between sm:text-left">
          <span>{company.legal}</span>
          <span>{company.locations}</span>
        </div>
      </Container>
    </footer>
  );
}

export default Footer;
