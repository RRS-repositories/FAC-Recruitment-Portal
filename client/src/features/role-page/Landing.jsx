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
        Fast Action Claims<small>Rowan Rose Ltd · SRA 8000843</small>
      </div>
      <Link to="/admin">Manager login</Link>
    </nav>
  );
}

export function LandingFooter() {
  return (
    <footer className="wrap">
      <div className="foot">
        Fast Action Claims is a trading style of Rowan Rose Ltd, a firm of solicitors authorised
        and regulated by the Solicitors Regulation Authority (SRA No. 8000843). Company No.
        12916452.
        <br />
        Questions? {RECRUIT_EMAIL}
      </div>
    </footer>
  );
}
