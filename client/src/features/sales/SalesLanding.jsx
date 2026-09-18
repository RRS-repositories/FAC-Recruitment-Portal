import { HeroPhoto, LandingFooter, LandingNav } from '@/features/role-page/Landing';
import heroPhoto from './assets/sales-hero.jpg';

/**
 * The public landing: hero, stats, the role, the pay card, the closing band.
 *
 * Copy is the design's, word for word. The nav, the photo and the footer are
 * the role pages' shared pieces (features/role-page/Landing.jsx).
 */
export function SalesLanding({ onStart }) {
  return (
    <div>
      <header className="hero">
        <HeroPhoto src={heroPhoto} />
        <div className="wrap hero-in">
          <LandingNav />
          <div className="pill">
            <i aria-hidden="true" /> Now hiring · Cape Town / Johannesburg / remote SA
          </div>
          <h1>Sales &amp; customer service. South Africa.</h1>
          <p className="lead">
            Join one of the UK's fastest-growing law firms. You'll speak to people who
            may have been treated unfairly by lenders and bookmakers — and help them do something
            about it.
          </p>
          <button type="button" className="btn" onClick={onStart}>
            Start your application
          </button>
        </div>
      </header>

      <main className="wrap">
        <div className="stats">
          <div className="stat">
            <b>£12m+</b>
            <span>recovered for clients</span>
          </div>
          <div className="stat">
            <b>120+</b>
            <span>staff across UK, SA &amp; India</span>
          </div>
          <div className="stat">
            <b>R13k</b>
            <span>on-target monthly earnings</span>
          </div>
          <div className="stat">
            <b>UK hrs</b>
            <span>9am – 6pm, Mon–Fri</span>
          </div>
        </div>

        <div className="section two">
          <div>
            <h2>What the role is</h2>
            <p>
              You'll call people who've enquired about a claim, explain in plain English
              who we are and how it works, and sign up the ones we can genuinely help. You'll
              also look after existing clients — answering questions, keeping them updated and making
              sure nobody feels forgotten.
            </p>
            <p>
              We're an SRA-regulated law firm. That means honesty on every call, no pressure
              tactics and no promises we can't keep. If you're good at talking to people
              and you like a target, you'll do well here.
            </p>
            <h2 style={{ marginTop: 30 }}>What you'll be doing</h2>
            <ul className="check">
              <li>
                Outbound calls to warm leads who've asked about irresponsible lending, gambling
                harm or car finance claims
              </li>
              <li>Explaining the process clearly and signing clients up on the call</li>
              <li>Inbound customer service — updates, questions, keeping clients informed</li>
              <li>Logging every call accurately in our CRM</li>
              <li>Hitting a weekly sign-up target with bonus for going over it</li>
            </ul>
          </div>
          <div>
            <div className="pay">
              <div className="big">
                R6,000 <small>/ month basic</small>
              </div>
              <div className="ote">
                <b>R13,000 OTE</b>with monthly bonus on sign-ups — uncapped for top performers
              </div>
              <ul className="check" style={{ marginTop: 16 }}>
                <li>Permanent, full-time role</li>
                <li>UK hours: 9:00 AM – 6:00 PM UK time</li>
                <li>45-min lunch plus a 15-min afternoon break</li>
                <li>Full training on our claims and scripts</li>
                <li>Clear path into team leader roles</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="band">
          <h3>Ready to talk?</h3>
          <p>
            The application takes about 25–35 minutes. You'll need a quiet spot for a short
            voice recording and a copy of your CV.
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

export default SalesLanding;
