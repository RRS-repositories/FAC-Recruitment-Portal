import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Reveal } from '@/components/ui/Reveal';
import { Icon } from '@/components/ui/Icon';
import { getRole } from '@/data/roles';
import { COMPANY, WHAT_YOU_DO } from '@/data/company';
import usePageMeta from '@/hooks/usePageMeta';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * The public role page, laid out as the signed-off prototype.
 *
 * The hero photograph is masked twice — once left-to-right so it dissolves
 * into the headline rather than ending on a hard edge, once bottom-up so the
 * stat cards have something to sit against. Both come straight from the
 * prototype's stylesheet; the numbers are its numbers.
 */
export function RoleLandingPage() {
  const { roleKey } = useParams();
  const role = getRole(roleKey);

  usePageMeta({
    title: role ? `${role.title} — Fast Action Claims Careers` : 'Careers',
    description: role?.sub,
  });

  // A slug that is not a role is a wrong address, not a reason to show the
  // home page. Sending it there was how /nope and the privacy link both ended
  // up quietly rendering a job advert.
  if (!role) return <NotFoundPage />;

  const applyTo = `/recruitment/apply/${role.key}`;

  return (
    <AppShell
      navRight={
        <>
          <Button to="/" variant="ghost" size="sm">
            All roles
          </Button>
          <Button href="/admin" variant="ghost" size="sm">
            Manager login
          </Button>
        </>
      }
    >
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="hero-glow relative overflow-hidden bg-brand text-white">
        <div className="relative mx-auto grid max-w-[1120px] lg:min-h-[560px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="z-[2] flex flex-col justify-center px-6 pb-6 pt-14 sm:px-8 lg:py-[72px] lg:pl-8 lg:pr-10">
            <p className="mb-[22px] inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.22] bg-white/10 px-3.5 py-[7px] text-[0.78rem] font-semibold tracking-wide backdrop-blur">
              <span
                aria-hidden="true"
                className="h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.25)]"
              />
              {role.pill}
            </p>

            <h1 className="text-[2.5rem] font-black leading-[1.02] tracking-[-0.035em] sm:text-[3.5rem]">
              {role.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>

            <p className="mt-[18px] max-w-[520px] text-[1.125rem] leading-relaxed text-white/[0.82]">
              {role.sub}
            </p>

            <div className="mt-[30px] flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button to={applyTo} size="lg" className="px-[34px] py-4">
                Start your application
              </Button>
              <span className="text-[0.875rem] text-white/70">Takes about 10 minutes</span>
            </div>

            <a
              href={COMPANY.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-fit items-center gap-1.5 border-b border-white/35 pb-0.5 text-[0.875rem] font-medium text-white/85 transition-colors hover:border-white hover:text-white"
            >
              Check us out at {COMPANY.website}
              <Icon name="arrowRight" size={14} className="-rotate-45" />
            </a>
          </div>

          {/* The photograph. Decorative: everything it conveys is already in
              the words beside it, so it carries an empty alt. */}
          <div className="relative min-h-[320px] lg:min-h-[380px]">
            <img
              src={role.photo}
              alt=""
              className="hero-photo absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: role.photoPosition }}
            />
            <div aria-hidden="true" className="hero-photo-wash absolute inset-0" />
          </div>
        </div>
      </section>

      {/* Stats overlap the hero, which is what makes them read as proof of it.
          `relative z-10` is load-bearing: the hero is positioned, so without a
          stacking context of its own this section paints UNDERNEATH it and the
          numbers get clipped by the hero's bottom edge. */}
      <section className="relative z-10 mx-auto -mt-[46px] max-w-[1120px] px-6">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {COMPANY.stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 70}>
              <StatCard value={stat.value} label={stat.label} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Who we are / what the job is ──────────────────────────────── */}
      <section id="the-role" className="mx-auto grid max-w-[1120px] scroll-mt-6 gap-10 px-6 pt-14 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <h2 className="text-[1.6rem] font-extrabold tracking-tight text-ink sm:text-[1.75rem]">
            Who we are
          </h2>
          <p className="mt-2 text-[0.97rem] leading-[1.7] text-body">{COMPANY.who}</p>

          <h2 className="mt-9 text-[1.6rem] font-extrabold tracking-tight text-ink sm:text-[1.75rem]">
            {role.whyHeading}
          </h2>
          <p className="mt-2 text-[0.97rem] leading-[1.7] text-body">{role.why}</p>
          <p className="mt-4 text-[0.97rem] leading-[1.7] text-body">{role.contract}</p>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-card bg-lav-soft px-[26px] pb-[18px] pt-[26px]">
            <h3 className="text-[1.05rem] font-bold text-ink">What you&rsquo;ll be doing</h3>
            <ul className="mt-4">
              {WHAT_YOU_DO.map((item) => (
                <li key={item} className="mb-3 flex items-start gap-[11px] text-[0.94rem] leading-[1.55] text-body">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full bg-ok text-white"
                  >
                    <Icon name="check" size={11} strokeWidth={3.5} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3.5 rounded-card bg-white px-[26px] py-[22px] shadow-card">
            <h3 className="text-[1.05rem] font-bold text-ink">What you need</h3>
            <p className="mt-2 text-[0.94rem] leading-[1.55] text-body">{role.need.join(' · ')}</p>
          </div>
        </Reveal>
      </section>

      {/* ── Closing CTA ───────────────────────────────────────────────── */}
      <section className="hero-glow relative mt-16 overflow-hidden bg-brand px-6 py-14 text-center text-white">
        <div className="relative z-10 mx-auto max-w-2xl">
          <h2 className="text-[1.75rem] font-black tracking-[-0.03em] sm:text-[2rem]">
            Ready to show us what you&rsquo;re made of?
          </h2>
          <p className="mx-auto mt-3 text-[1rem] text-white/80">
            Applications are reviewed within 48 hours.
          </p>
          <div className="mt-7 flex justify-center">
            <Button to={applyTo} variant="white" size="lg" className="px-9 py-4">
              Start your application
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

export default RoleLandingPage;
