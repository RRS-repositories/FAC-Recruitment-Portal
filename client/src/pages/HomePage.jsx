import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { ROLES } from '@/data/roles';
import usePageMeta from '@/hooks/usePageMeta';

/**
 * Role chooser.
 *
 * In production each role has its own URL and candidates arrive directly from
 * Internshala or a job board — this page exists so both can be reached and
 * compared, and as the landing point for anyone who finds the domain root.
 */
export function HomePage() {
  usePageMeta({
    title: 'Careers — Fast Action Claims',
    description: 'Paralegal roles with one of the UK’s fastest-growing law firms. Remote from India and South Africa.',
  });

  return (
    <AppShell>
      <section className="hero-glow relative overflow-hidden bg-brand text-white">
        <div className="relative z-10 mx-auto max-w-shell px-5 py-20 text-center sm:px-8">
          <h1 className="mx-auto max-w-3xl text-display-xl font-black">Build a legal career with us.</h1>
          <p className="mx-auto mt-5 max-w-xl text-[1.05rem] leading-relaxed text-white/80">
            We&rsquo;re one of the UK&rsquo;s fastest-growing law firms, recovering millions for
            people who&rsquo;ve been treated unfairly — and we&rsquo;re hiring remotely.
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-12 max-w-shell px-5 pb-20 sm:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          {Object.values(ROLES).map((role, i) => (
            <Reveal key={role.key} delay={i * 100}>
              <article className="flex h-full flex-col rounded-card bg-white p-7 shadow-card">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-lav px-3 py-1 text-[0.75rem] font-bold uppercase tracking-wide text-violet-deep">
                  <Icon name="globe" size={13} />
                  {role.country}
                </span>
                <h2 className="mt-4 text-[1.4rem] font-extrabold tracking-tight text-ink">
                  {role.title}
                </h2>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-muted">{role.location} · {role.contractType}</p>
                <p className="mt-4 flex-1 text-[0.92rem] leading-relaxed text-body">{role.why}</p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <Button to={`/${role.key}`}>
                    View the role
                    <Icon name="arrowRight" size={16} />
                  </Button>
                  <Button to={`/apply/${role.key}`} variant="secondary">
                    Apply now
                  </Button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

export default HomePage;
