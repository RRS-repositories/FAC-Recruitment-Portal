import { forwardRef } from 'react';
import { STEP_LABELS } from './content';

/** The violet band and brand line shared by the form pages and the thanks screen. */
export function FormBand({ children, style }) {
  return (
    <div className="formhead" style={style}>
      <div className="wrap">
        <div className="brand">
          Fast Action Claims<small>Sales &amp; Customer Service · South Africa</small>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The design's FormHead: band, five-step progress, and the white card.
 *
 * The title is the page's <h1> and takes focus (via the forwarded ref) on each
 * step change, so a keyboard or screen-reader user lands on the new step
 * rather than on the button they just pressed.
 */
export const FormShell = forwardRef(function FormShell({ step, title, sub, children }, titleRef) {
  return (
    <div>
      <FormBand>
        <div className="prog" role="list" aria-label="Application progress">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              role="listitem"
              className={i < step ? 'done' : i === step ? 'on' : ''}
              aria-current={i === step ? 'step' : undefined}
            >
              {label}
            </div>
          ))}
        </div>
      </FormBand>
      <main className="wrap">
        <div className="card">
          <h1 className="card-title" ref={titleRef} tabIndex={-1}>
            {title}
          </h1>
          <p className="sub">{sub}</p>
          {children}
        </div>
      </main>
    </div>
  );
});

/** The design's red line under a step. Announced when it appears. */
export function ErrorLine({ message }) {
  return message ? (
    <div className="err" role="alert">
      {message}
    </div>
  ) : null;
}

/** Back + the wide primary button, as every step ends. */
export function StepRow({ onBack, backLabel = 'Back', children }) {
  return (
    <div className="row">
      <button type="button" className="btn2" onClick={onBack}>
        {backLabel}
      </button>
      {children}
    </div>
  );
}

export default FormShell;
