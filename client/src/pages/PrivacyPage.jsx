import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import usePageMeta from '@/hooks/usePageMeta';

/**
 * What we do with a candidate's data, in the words of what the code does.
 *
 * Written from the system rather than from a template: every claim here is
 * something the portal demonstrably does. The behavioural measures under
 * "How your answers are checked" are exactly the ones `useTelemetry` records,
 * and the retention period is fetched rather than written down, because an
 * administrator can change it from the Settings screen and a notice that
 * disagreed with the software would be worse than no notice at all.
 *
 * Deliberately readable by somebody who is not a lawyer. It still needs
 * signing off by whoever is accountable for data protection before launch.
 */

const CONTROLLER = 'Rowan Rose Ltd, trading as Fast Action Claims';

function Section({ title, children }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-[1.05rem] font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-[0.92rem] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  usePageMeta({
    title: 'How we handle your data — Fast Action Claims recruitment',
    description:
      'What we collect when you apply for a role at Fast Action Claims, why we hold it, how long we keep it, and what you can ask us to do.',
  });

  const [facts, setFacts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/recruit/privacy')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok) setFacts(data);
      })
      .catch(() => {
        /* the page has wording for not knowing */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const months = facts?.retentionMonths;
  const contact = facts?.contactEmail;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-muted">
          Recruitment
        </p>
        <h1 className="mt-2 text-[1.9rem] font-black leading-tight text-ink sm:text-[2.2rem]">
          How we handle your data
        </h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
          This explains what happens to the information you give us when you apply for a role. It
          covers our recruitment only — it is not about how we handle client claims.
        </p>

        <Card className="mt-8">
          <Section title="Who holds your data">
            <p>
              {CONTROLLER} is the data controller. Your application is stored and reviewed in the
              United Kingdom, including when you apply from India or South Africa.
            </p>
          </Section>

          <Section title="What we collect">
            <p>When you apply, we record:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>your name, email address and phone number;</li>
              <li>the CV file you upload;</li>
              <li>your written answers, and your answers to the multiple-choice questions;</li>
              <li>which role you applied for, and the timezone your browser reports.</li>
            </ul>
            <p>
              We also record a one-way scrambled version of your IP address. It cannot be turned
              back into your address; it exists so we can tell when one person submits hundreds of
              applications.
            </p>
          </Section>

          <Section title="How your answers are checked">
            <p>
              We check whether written answers appear to have been produced by an AI tool. To do
              that, while you fill the form we measure how much text is pasted rather than typed,
              how quickly it is typed, how long you spend on the written section, and how many times
              you switch away from the tab. We do not record what you type — only those measures.
            </p>
            <p>
              Your answers are also marked against a scoring scheme. Both of these inform a person;
              neither decides anything on its own.{' '}
              <b className="font-semibold text-ink">
                Every decision to progress or decline an application is made by a member of our team
              </b>
              , and we record who made it.
            </p>
          </Section>

          <Section title="Why we are allowed to hold it">
            <p>
              We rely on taking steps at your request before entering into a contract of employment,
              and on our legitimate interest in running a fair recruitment process. You consent to
              us storing your CV at the point you submit it.
            </p>
          </Section>

          <Section title="Who sees it">
            <p>
              Only our own recruitment team, through individually named accounts, so that every
              decision is attributable to a person. We do not sell your data, and we do not pass it
              to recruiters or advertisers.
            </p>
            <p>
              Our emails to you are delivered through Microsoft, and the interview itself takes place
              over a video call. Those providers carry the message and the call; they are not given
              your application.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              {months
                ? `If we do not take your application further, your CV file is deleted automatically once it is ${months} month${months === 1 ? '' : 's'} old.`
                : 'If we do not take your application further, your CV file is deleted automatically once it reaches the age we have set for that.'}{' '}
              The record of the application itself — the answers, the score and the decision — is
              kept for longer, so that we can show our recruitment was fair and consistent if we are
              ever asked to.
            </p>
          </Section>

          <Section title="What you can ask us to do">
            <p>
              You can ask for a copy of what we hold about you, ask us to correct it, ask us to
              delete it, or object to us holding it at all. You do not need to give a reason, and
              asking will not count against you if you apply to us again.
            </p>
            <p>
              {contact ? (
                <>
                  Write to{' '}
                  <a
                    href={`mailto:${contact}`}
                    className="font-semibold text-violet-deep underline underline-offset-2"
                  >
                    {contact}
                  </a>
                  .
                </>
              ) : (
                'Write to our recruitment team, at the address you were contacted from.'
              )}{' '}
              If you are unhappy with how we respond, you can complain to the Information
              Commissioner&rsquo;s Office at ico.org.uk.
            </p>
          </Section>
        </Card>

        <p className="mt-8 text-[0.88rem]">
          <Link to="/" className="font-semibold text-violet-deep underline underline-offset-2">
            Back to our roles
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
