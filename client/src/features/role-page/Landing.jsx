import { Link } from 'react-router-dom';
import { RECRUIT_EMAIL } from './content';

/*
 * The pieces every role's landing page repeats word for word. The rest of
 * each landing — its copy, stats, pay card and layout — is the role's own
 * component (features/<role>/…Landing.jsx).
 */

/** The hero photograph. Decorative: everything it shows is said in the words beside it. */
export function HeroPhoto({ src }) {
  return <div className="hero-img" aria-hidden="true" style={{ backgroundImage: `url(${src})` }} />;
}

/** Brand and "Manager login" — to the portal's real dashboard, not the prototypes' demo one. */
export function LandingNav() {
  return (
    <nav className="nav" aria-label="Site">
      <div className="brand">
        Beacon Legal Group<small>Rowan Rose Ltd</small>
      </div>
      <Link to="/admin">Manager login</Link>
    </nav>
  );
}

export function LandingFooter() {
  return (
    <footer className="wrap">
      <div className="foot">
        Beacon Legal Group is a trading style of Rowan Rose Ltd. Company No. 12916452.
        <br />
        Questions? {RECRUIT_EMAIL}
      </div>
    </footer>
  );
}
