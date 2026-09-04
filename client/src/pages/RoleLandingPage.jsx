import { Navigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Reveal } from '@/components/ui/Reveal';
import { Icon } from '@/components/ui/Icon';
import { getRole } from '@/data/roles';
import usePageMeta from '@/hooks/usePageMeta';

/**
 * The public role page — the thesis of the whole portal: this is a real legal
 * career, not a back-office job. Hero, proof, what the work is, what we need,
 * then apply.
 */
export function RoleLandingPage() {
  const { roleKey } = useParams();
  const role = getRole(roleKey);

  usePageMeta({
    title: role ? `${role.title} — Fast Action Claims Careers` : 'Careers',
    description: role?.sub,
  });

  if (!role) return <Navigate to="/" replace />;

  return (
    <AppShell
      navRight={
        <Button to={`/apply/${role.key}`} size="sm">
          Apply now
        </Button>
      }
    >
      {/* Hero */}
      <section className="hero-glow relative overflow-hidden bg-brand text-white">
        <div className="relative z-10 mx-auto grid max-w-shell gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[0.78rem] font-semibold tracking-wide">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.25)]" />
              {role.pill}
            </p>

            <h1 className="text-display-xl font-black">
              {role.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>

            <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-white/80">{role.sub}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button to={`/apply/${role.key}`} size="lg">
                Start your application
                <Icon name="arrowRight" size={18} />
              </Button>
              <Button variant="ghost" size="lg" href="#the-role">
                What the role involves
              </Button>
            </div>

            <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.85rem] text-white/65">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="globe" size={15} />
                {role.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="briefcase" size={15} />
                {role.contractType}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" size={15} />
                Takes about 10 minutes
              </span>
            </p>
          </div>

          {/* Decorative panel. Marked aria-hidden — it carries no information
              that isn't already in the text beside it. */}
          <div aria-hidden="true" className="hidden lg:block">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-sm rounded-card border border-white/15 bg-white/[0.07] p-6 backdrop-blur">
              <div className="space-y-3">
                {['Case review', 'Client update drafted', 'Claim submitted', 'Offer received'].map(
                  (label, i) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-panel bg-white/10 px-4 py-3"
                      style={{ opacity: 1 - i * 0.16 }}
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400/90 text-ink">
                        <Icon name="check" size={14} strokeWidth={3} />
                      </span>
                      <span className="text-[0.88rem] font-medium">{label}</span>
                    </div>
                  ),
                )}
              </div>
              <p className="mt-6 text-[0.8rem] text-white/60">
                Real files, real outcomes — from your first month.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats overlap the hero, which is what makes them read as proof of it.
          `relative z-10` is load-bearing: the hero is positioned, so without a
          stacking context of its own this section paints UNDERNEATH it and the
          numbers get clipped by the hero's bottom edge. */}
      <section className="relative z-10 mx-auto -mt-10 max-w-shell px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {role.stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 70}>
              <StatCard value={stat.value} label={stat.label} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* The role */}
      <section id="the-role" className="mx-auto max-w-shell scroll-mt-6 px-5 py-16 sm:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <h2 className="text-display-lg font-extrabold text-ink">{role.whyHeading}</h2>
            <p className="mt-4 text-[1rem] leading-relaxed text-body">{role.why}</p>
            <p className="mt-4 rounded-panel border-l-4 border-violet bg-lav-soft px-5 py-4 text-[0.95rem] leading-relaxed text-ink">
              {role.contract}
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-card bg-white p-6 shadow-card sm:p-7">
              <h3 className="text-[1.05rem] font-bold text-ink">What we need from you</h3>
              <ul className="mt-4 grid gap-3">
                {role.need.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[0.92rem] leading-relaxed">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-violet text-white"
                    >
                      <Icon name="check" size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 border-t border-line pt-5">
                <Button to={`/apply/${role.key}`} className="w-full">
                  Apply for this role
                </Button>
                <p className="mt-3 text-center text-[0.78rem] text-muted">
                  No cover letter needed — the questions are the application.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="hero-glow relative overflow-hidden bg-brand px-5 py-14 text-center text-white sm:px-8">
        <div className="relative z-10 mx-auto max-w-2xl">
          <h2 className="text-display-lg font-extrabold">Ready to apply?</h2>
          <p className="mx-auto mt-3 max-w-lg text-[1rem] text-white/80">
            Ten minutes now. If you&rsquo;re shortlisted you&rsquo;ll pick your own interview slot
            — no back-and-forth over email.
          </p>
          <div className="mt-7 flex justify-center">
            <Button to={`/apply/${role.key}`} size="lg">
              Start your application
              <Icon name="arrowRight" size={18} />
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

export default RoleLandingPage;
