import { HeroPhoto, LandingFooter, LandingNav } from '@/features/role-page/Landing';
import heroPhoto from './assets/aidev-hero.jpg';

/** The hero's technology tags, in the design's order. */
const TAGS = ['n8n', 'Node / Python', 'Postgres', 'LLM agents', 'Docker', 'Claude Code'];

/**
 * The public landing: hero with its tags, stats, the role, the pay card, the
 * closing band.
 *
 * Copy is the design's, word for word. The nav, the photo and the footer are
 * the role pages' shared pieces (features/role-page/Landing.jsx).
 */
export function AiDevLanding({ onStart }) {
  return (
    <div>
      <header className="hero">
        <HeroPhoto src={heroPhoto} />
        <div className="wrap hero-in">
          <LandingNav />
          <div className="pill">
            <i aria-hidden="true" /> Now hiring · Remote, India · UK hours
          </div>
          <h1>AI developer. Build the platform with us.</h1>
          <p className="lead">
            We're a UK law firm building our own AI-driven CRM, automation and agent platform.
            We need a developer who already understands CRMs, workflows and LLM tooling — and
            wants to build something bigger.
          </p>
          <ul className="hero-tags" aria-label="What we build with">
            {TAGS.map((tag) => (
              <li className="tag" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={onStart}>
            Start your application
          </button>
        </div>
      </header>

      <main className="wrap">
        <div className="stats">
          <div className="stat">
            <b>1 CRM</b>
            <span>built in-house, 20k+ clients</span>
          </div>
          <div className="stat">
            <b>50+</b>
            <span>live automations &amp; agents</span>
          </div>
          <div className="stat">
            <b>Remote</b>
            <span>work from anywhere in India</span>
          </div>
          <div className="stat">
            <b>UK hrs</b>
            <span>9am – 6pm UK, Mon–Fri</span>
          </div>
        </div>

        <div className="section two">
          <div>
            <h2>What you'd be building</h2>
            <p>
              We run a custom CRM, an email-processing AI (ECHOE), WhatsApp document-collection
              workflows, an AI customer-service team and an AI "office" of agents that work
              inside the CRM. All of it is built and hosted by us. You'll join the team
              extending it.
            </p>
            <p>
              This isn't a ticket-queue job. You'll take a feature from a plain-English brief
              through design, build, test and deploy, working directly with our UK head of
              development and using AI coding tools as a normal part of the workflow.
            </p>
            <h2 style={{ marginTop: 30 }}>What we're looking for</h2>
            <ul className="check">
              <li>
                Real experience with CRM systems — the data model, integrations and the messy
                edges
              </li>
              <li>
                Automations you've built and kept running: n8n, Make, custom code, webhooks,
                queues
              </li>
              <li>
                Production use of LLM APIs — structured outputs, tool calls, cost and error
                handling
              </li>
              <li>Comfortable on a Linux VPS with Docker, Postgres and Git</li>
              <li>Honest about what you don't know, and quick to flag problems early</li>
            </ul>
          </div>
          <div>
            <div className="pay">
              <div className="big">
                ₹30,000 <small>/ month</small>
              </div>
              <div className="ote">
                <b>Full-time, permanent</b>reviewed on delivery — with a clear path to senior and
                lead roles as the platform grows
              </div>
              <ul className="check" style={{ marginTop: 16 }}>
                <li>UK hours: 9:00 AM – 6:00 PM UK time</li>
                <li>Fully remote — work from anywhere in India</li>
                <li>Modern stack, AI tooling provided</li>
                <li>Ownership of real features from week one</li>
                <li>Work directly with our UK head of development</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="band">
          <h3>Think you can build with us?</h3>
          <p>
            The application takes 30–40 minutes. Written answers, twelve technical scenarios, then
            your CV. Please write your own answers — we detect pasted and AI-generated text.
          </p>
          <button type="button" className="btn" onClick={onStart}>
            Start your application
          </button>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

export default AiDevLanding;
