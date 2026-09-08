import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Flag } from '@/components/ui/Flag';
import { ROLES } from '@/data/roles';
import usePageMeta from '@/hooks/usePageMeta';

/**
 * Open positions — the prototype's role chooser.
 *
 * Two things from the prototype are deliberately left out. It captioned itself
 * "Demo entry point — in production each role has its own URL" and closed with
 * a note about suggested production URLs; both are the prototype talking about
 * itself, and neither means anything to a candidate. Those URLs now exist, and
 * this page links to them.
 *
 * The flags are SVG rather than the prototype's emoji. Regional-indicator
 * emoji render as bare letter pairs on Windows — which is why the prototype's
 * own screenshots read "IN Paralegal Internship" — so `Flag` exists to draw
 * them properly. See CLAUDE.md.
 */
export function HomePage() {
  usePageMeta({
    title: 'Open positions — Fast Action Claims Careers',
    description:
      'Paralegal roles at Fast Action Claims, remote from India and South Africa. Apply in about ten minutes.',
  });

  return (
    <AppShell
      navRight={
        <Button href="/admin" variant="ghost" size="sm">
          Manager dashboard
        </Button>
      }
    >
      <div className="mx-auto max-w-[900px] px-6 py-14 sm:py-[60px]">
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[2.125rem]">
          Open positions
        </h1>

        <div className="mt-7 grid gap-[18px] sm:grid-cols-2">
          {Object.values(ROLES).map((role) => (
            <Link
              key={role.key}
              to={`/recruitment/${role.key}`}
              className="group block overflow-hidden rounded-[18px] bg-white shadow-card transition-transform duration-200 ease-brand hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              {/* The photograph is knocked back into the brand violet the same
                  way the prototype did it: luminosity over the gradient, with
                  a plum wash rising from the bottom so the title stays legible
                  whatever the image underneath is doing. */}
              <div className="relative h-[170px] overflow-hidden bg-brand">
                <img
                  src={role.photo}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover opacity-[0.85] mix-blend-luminosity"
                  style={{ objectPosition: role.photoPosition }}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(0deg, rgba(46,16,101,0.9), transparent 70%)' }}
                />
                <h2 className="absolute bottom-3.5 left-[18px] right-4 flex items-center gap-2 text-[1.375rem] font-extrabold tracking-tight text-white">
                  <Flag country={role.countryCode} className="h-4 w-6 flex-shrink-0 rounded-[2px]" />
                  {role.title}
                </h2>
              </div>

              <div className="px-5 pb-5 pt-[18px]">
                <p className="text-[0.875rem] text-muted">{role.location}</p>
                <p className="mt-1.5 text-[0.8125rem] font-semibold text-violet-deep">
                  {role.contractType}
                </p>
                <p className="mt-3.5 text-[0.875rem] font-bold text-ink">
                  View &amp; apply{' '}
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-200 ease-brand group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  >
                    →
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default HomePage;
