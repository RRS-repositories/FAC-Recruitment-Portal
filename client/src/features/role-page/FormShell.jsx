import { forwardRef } from 'react';
import { useRoleConfig } from './RoleContext';

/** The violet band and brand line shared by the form pages and the thanks screen. */
export function FormBand({ children, style }) {
  const { brandLine } = useRoleConfig();
  return (
    <div className="formhead" style={style}>
      <div className="wrap">
        <div className="brand">
          Fast Action Claims<small>{brandLine}</small>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The designs' FormHead: band, the role's step progress, and the white card.
 *
 * `step` is the index into the role's steps. The title is the page's <h1> and
 * takes focus (via the forwarded ref) on each step change, so a keyboard or
 * screen-reader user lands on the new step rather than on the button they
 * just pressed.
 */
export const FormShell = forwardRef(function FormShell({ step, title, sub, children }, titleRef) {
  const { steps } = useRoleConfig();
  return (
    <div>
      <FormBand>
        <div className="prog" role="list" aria-label="Application progress">
          {steps.map(({ label }, i) => (
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

/** The designs' red line under a step. Announced when it appears. */
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
