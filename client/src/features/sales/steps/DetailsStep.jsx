import { useState } from 'react';
import { FormShell, ErrorLine, StepRow } from '../FormShell';
import { detailProblems } from '../helpers';

const TEXT_FIELDS = [
  { name: 'fullName', label: 'Full name', placeholder: 'e.g. Thandi Nkosi', autoComplete: 'name' },
  { name: 'email', label: 'Email address', placeholder: 'you@example.com', type: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'Mobile number', placeholder: '+27 82 000 0000', type: 'tel', autoComplete: 'tel' },
  { name: 'city', label: 'City / area', placeholder: 'e.g. Cape Town', autoComplete: 'address-level2' },
];

const SELECT_FIELDS = [
  { name: 'qualification', label: 'Highest qualification', list: 'qualifications' },
  { name: 'experience', label: 'Years of sales / call-centre experience', list: 'experience' },
  { name: 'heardFrom', label: 'Where did you hear about this role?', list: 'heardFrom' },
  { name: 'noticePeriod', label: 'Notice period', list: 'noticePeriods' },
];

/**
 * Step 1 — details. The design's two-column grid and its single message.
 *
 * `serverErrors` are the server's per-field refusals from a submit; they are
 * shown under the field they belong to, and cleared as that field is edited.
 */
export function DetailsStep({ values, onChange, options, serverErrors, onClearServerError, onBack, onNext, titleRef }) {
  const [tried, setTried] = useState(false);
  const problems = tried ? detailProblems(values) : {};
  const hasProblems = Object.keys(problems).length > 0;

  const update = (name) => (event) => {
    onChange({ ...values, [name]: event.target.value });
    if (serverErrors?.[name]) onClearServerError(name);
  };

  const next = () => {
    setTried(true);
    if (Object.keys(detailProblems(values)).length) return;
    onNext();
  };

  const fieldProps = (name) => {
    const serverMessage = serverErrors?.[name];
    return {
      id: `sales-${name}`,
      name,
      className: 'in',
      value: values[name],
      onChange: update(name),
      'aria-invalid': problems[name] || serverMessage ? 'true' : undefined,
      'aria-describedby': serverMessage ? `sales-${name}-err` : undefined,
    };
  };

  const serverLine = (name) =>
    serverErrors?.[name] ? (
      <div className="field-err" id={`sales-${name}-err`}>
        {String(serverErrors[name])}
      </div>
    ) : null;

  return (
    <FormShell
      ref={titleRef}
      step={0}
      title="Your details"
      sub="We'll only use these to contact you about this application."
    >
      <div className="grid2">
        {TEXT_FIELDS.map((f) => (
          <div key={f.name}>
            <label className="f" htmlFor={`sales-${f.name}`}>
              {f.label}
            </label>
            <input
              {...fieldProps(f.name)}
              type={f.type ?? 'text'}
              placeholder={f.placeholder}
              autoComplete={f.autoComplete}
            />
            {serverLine(f.name)}
          </div>
        ))}
        {SELECT_FIELDS.map((f) => (
          <div key={f.name}>
            <label className="f" htmlFor={`sales-${f.name}`}>
              {f.label}
            </label>
            <select {...fieldProps(f.name)}>
              <option value="" />
              {options[f.list].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {serverLine(f.name)}
          </div>
        ))}
      </div>

      <div className="warn">
        <b>Please write your own answers.</b> We check for AI-written responses. Anything that looks
        generated is flagged to the hiring manager and will count against you. We'd much
        rather read your real words, spelling mistakes and all.
      </div>

      <ErrorLine
        message={hasProblems ? 'Please complete every field (and check your email address).' : ''}
      />
      <StepRow onBack={onBack}>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={next}>
          Continue
        </button>
      </StepRow>
    </FormShell>
  );
}

export default DetailsStep;
