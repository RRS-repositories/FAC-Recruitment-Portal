import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Section } from '@/features/landing/Section';
import { SectionHeading } from '@/features/landing/SectionHeading';
import { FeatureCard } from '@/features/landing/FeatureCard';
import { FaqAccordion } from '@/features/landing/FaqAccordion';
import { ROLES } from '@/data/roles';
import { CLAIM_AREAS, COMPANY, FAQS, HIRING_STEPS, WHAT_YOU_DO, WHY_JOIN } from '@/data/company';
import usePageMeta from '@/hooks/usePageMeta';

/**
 * The careers landing page.
 *
 * Structure follows the conversion pattern for a hiring page: establish who we
 * are, prove it, show the actual jobs, remove the anxiety about applying, then
 * ask. The open roles sit high on the page rather than at the bottom — someone
 * arriving from a job board already knows they want to apply, and making them
 * scroll past a company story first is a good way to lose them.
 *
 * All copy comes from the supplied build spec and prototype. Nothing about the
 * firm is invented, and there are no testimonials, because none were provided
 * and inventing employee quotes is not something to do on a careers page.
 */
export function HomePage() {
  usePageMeta({
    title: 'Careers — Fast Action Claims',
    description: COMPANY.intro,
  });

  return (
    <AppShell
      navRight={
        <Button href="#roles" size="sm">
          View open roles
        </Button>
      }
    >
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="hero-glow relative overflow-hidden bg-brand text-white">
        <div className="relative z-10 mx-auto grid max-w-shell gap-12 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28 lg:pt-24">
          <div className="max-w-2xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[0.78rem] font-semibold tracking-wide">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.25)]"
              />
              Now hiring in India and South Africa
            </p>

            <h1 className="text-display-xl font-black">{COMPANY.tagline}</h1>

            <p className="mt-6 max-w-2xl text-[1.1rem] leading-relaxed text-white/80">
              {COMPANY.intro}
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="#roles" size="lg">
                See open roles
                <Icon name="arrowRight" size={18} />
              </Button>
              <Button variant="ghost" size="lg" href="#how">
                How hiring works
              </Button>
            </div>

            <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.86rem] text-white/65">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" size={15} />
                10-minute application
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="mail" size={15} />
                Reply within 48 hours
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="globe" size={15} />
                Fully remote
              </span>
            </p>
          </div>

          {/* The roles, in the hero. Someone arriving from a job board already
              knows they want to apply — making them scroll past a company story
              to find the jobs is a good way to lose them. It also balances a
              hero that was otherwise half empty on wide screens. */}
          <div className="hidden lg:block">
            <div className="rounded-card border border-white/15 bg-white/[0.07] p-5 backdrop-blur">
              <p className="mb-3 px-1 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/55">
                Open right now
              </p>

              <div className="grid gap-2.5">
                {Object.values(ROLES).map((role) => (
                  <Link
                    key={role.key}
                    to={`/apply/${role.key}`}
                    className="group flex items-center gap-3.5 rounded-panel bg-white/10 p-4 transition-colors duration-200 hover:bg-white/20"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-control bg-white/15 text-white"
                    >
                      <Icon name="briefcase" size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.95rem] font-bold text-white">{role.title}</span>
                      <span className="block text-[0.8rem] text-white/60">{role.location}</span>
                    </span>
                    <Icon
                      name="arrowRight"
                      size={17}
                      className="flex-shrink-0 text-white/50 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                    />
                  </Link>
                ))}
              </div>

              <p className="mt-4 flex items-center gap-2 px-1 text-[0.8rem] text-white/55">
                <Icon name="shield" size={14} />
                SRA-regulated · {COMPANY.website}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof. Overlaps the hero so it reads as evidence for it. The
             `relative z-10` is load-bearing — without its own stacking context
             this paints under the positioned hero and gets clipped. ─────── */}
      <div className="relative z-10 mx-auto -mt-14 max-w-shell px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {COMPANY.stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 70}>
              <StatCard value={stat.value} label={stat.label} />
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── Who we are ─────────────────────────────────────────────────── */}
      {/* Heading above the grid rather than beside it. A short heading next to
          six tall cards leaves a dead column on wide screens — the content has
          to set the shape, not the other way round. */}
      <Section id="about" tone="plain">
        <SectionHeading
          eyebrow="Who we are"
          title="A law firm that fights for people who were treated unfairly."
          sub={COMPANY.who}
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CLAIM_AREAS.map((area, i) => (
            <Reveal key={area.title} delay={(i % 3) * 80}>
              <div className="h-full rounded-panel border border-line bg-white p-5 transition-[border-color,transform] duration-300 ease-brand hover:-translate-y-0.5 hover:border-violet-soft motion-reduce:hover:translate-y-0">
                <span
                  aria-hidden="true"
                  className="mb-3 grid h-10 w-10 place-items-center rounded-control bg-lav text-violet-deep"
                >
                  <Icon name={area.icon} size={19} />
                </span>
                <h3 className="text-[0.95rem] font-bold text-ink">{area.title}</h3>
                <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">{area.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── Open roles — the page's main job ───────────────────────────── */}
      <Section id="roles" tone="white">
        <SectionHeading
          eyebrow="Open roles"
          title="Two ways to join us."
          sub="Both are fully remote, both work UK-aligned hours, and both involve real casework from your first month."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {Object.values(ROLES).map((role, i) => (
            <Reveal key={role.key} delay={i * 110}>
              <article className="group flex h-full flex-col overflow-hidden rounded-card bg-white shadow-card ring-1 ring-line transition-[transform,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:shadow-lift motion-reduce:hover:translate-y-0">
                <div className="hero-glow relative overflow-hidden bg-brand px-6 py-7 text-white">
                  <div className="relative z-10">
                    <Badge tone="violet" className="bg-white/15 text-white">
                      {role.country}
                    </Badge>
                    <h3 className="mt-3 text-[1.45rem] font-extrabold tracking-tight">{role.title}</h3>
                    <p className="mt-1 text-[0.88rem] text-white/70">{role.contractType}</p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <p className="text-[0.94rem] leading-relaxed text-body">{role.why}</p>

                  <ul className="mt-5 grid flex-1 gap-2.5">
                    {role.need.slice(0, 3).map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[0.88rem] text-muted">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 grid h-4.5 w-[18px] flex-shrink-0 place-items-center rounded-full bg-violet/10 text-violet-deep"
                        >
                          <Icon name="check" size={11} strokeWidth={3} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-wrap gap-2.5 border-t border-line pt-5">
                    <Button to={`/apply/${role.key}`} className="flex-1">
                      Apply now
                      <Icon name="arrowRight" size={16} />
                    </Button>
                    <Button to={`/${role.key}`} variant="secondary">
                      Read more
                    </Button>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── What the job actually is ───────────────────────────────────── */}
      <Section tone="plain">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <SectionHeading
            align="left"
            eyebrow="The work"
            title="What you'll actually be doing."
            sub="Not filing and not shadowing. You hold live files and the outcomes are real."
          />

          <Reveal delay={100}>
            <ul className="grid gap-3">
              {WHAT_YOU_DO.map((item, i) => (
                <li
                  key={item}
                  className="flex items-start gap-4 rounded-panel bg-white p-5 shadow-card"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-cta text-[0.8rem] font-bold text-white tabular"
                  >
                    {i + 1}
                  </span>
                  <span className="text-[0.95rem] leading-relaxed text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      {/* ── Why join ───────────────────────────────────────────────────── */}
      <Section tone="white">
        <SectionHeading
          eyebrow="Why join us"
          title="Remote, but not peripheral."
          sub="Our teams in India and South Africa are core to how the firm runs — not a back office that gets handed the leftovers."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_JOIN.map((item, i) => (
            <Reveal key={item.title} delay={i * 80}>
              <FeatureCard {...item} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── How hiring works. The anxiety-remover: people abandon careers
             pages because they cannot tell what happens after they click. ── */}
      <Section id="how" tone="tint">
        <SectionHeading
          eyebrow="How hiring works"
          title="Four steps, and you always know where you stand."
          sub="No silence, no chasing, and you pick your own interview time."
        />

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HIRING_STEPS.map((step, i) => (
            <Reveal as="li" key={step.title} delay={i * 100} className="relative">
              <div className="h-full rounded-card bg-white p-6 shadow-card">
                <div className="mb-4 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 place-items-center rounded-control bg-cta text-white"
                  >
                    <Icon name={step.icon} size={19} />
                  </span>
                  <span className="text-[0.75rem] font-bold uppercase tracking-widest text-violet-deep tabular">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="text-[1rem] font-bold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[0.88rem] leading-relaxed text-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <Section id="faq" tone="plain">
        <SectionHeading
          eyebrow="Questions"
          title="Before you apply."
          sub="The things candidates ask us most often."
        />
        <div className="mt-12">
          <FaqAccordion items={FAQS} />
        </div>
      </Section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <Section tone="brand" className="text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-display-lg font-extrabold">
            Ready to show us what you&rsquo;re made of?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[1.02rem] text-white/80">
            Ten minutes to apply. Applications are reviewed within 48 hours, and you hear back
            either way.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {Object.values(ROLES).map((role) => (
              <Button key={role.key} to={`/apply/${role.key}`} size="lg">
                Apply — {role.country}
                <Icon name="arrowRight" size={17} />
              </Button>
            ))}
          </div>

          <p className="mt-8 text-[0.85rem] text-white/60">
            Learn more about the firm at{' '}
            <a
              href={COMPANY.websiteUrl}
              className="font-medium text-white underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              {COMPANY.website}
            </a>
          </p>
        </Reveal>
      </Section>
    </AppShell>
  );
}

export default HomePage;
