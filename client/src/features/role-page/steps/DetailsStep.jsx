import { useState } from 'react';
import { FormShell, ErrorLine, StepRow } from '../FormShell';
import { useRoleConfig } from '../RoleContext';
import { detailProblems, detailsMessage } from '../helpers';

/**
 * The details step — the designs' two-column grid and their single message,
 * drawn from the role's `detailFields` (text inputs and selects, in order).
 *
 * `serverErrors` are the server's per-field refusals from a submit; they are
 * shown under the field they belong to, and cleared as that field is edited.
 */
export function DetailsStep({
  step,
  values,
  onChange,
  options,
  serverErrors,
  onClearServerError,
  onBack,
  onNext,
  titleRef,
}) {
  const { idPrefix, detailFields, copy } = useRoleConfig();
  const [tried, setTried] = useState(false);
  const problems = tried ? detailProblems(values, detailFields) : {};

  const update = (name) => (event) => {
    onChange({ ...values, [name]: event.target.value });
    if (serverErrors?.[name]) onClearServerError(name);
  };

  const next = () => {
    setTried(true);
    if (Object.keys(detailProblems(values, detailFields)).length) return;
    onNext();
  };

  const idFor = (name) => `${idPrefix}-${name}`;

  const fieldProps = (name) => {
    const serverMessage = serverErrors?.[name];
    return {
      id: idFor(name),
      name,
      className: 'in',
      value: values[name],
      onChange: update(name),
      'aria-invalid': problems[name] || serverMessage ? 'true' : undefined,
      'aria-describedby': serverMessage ? `${idFor(name)}-err` : undefined,
    };
  };

  const serverLine = (name) =>
    serverErrors?.[name] ? (
      <div className="field-err" id={`${idFor(name)}-err`}>
        {String(serverErrors[name])}
      </div>
    ) : null;

  return (
    <FormShell ref={titleRef} step={step} title={copy.detailsTitle} sub={copy.detailsSub}>
      <div className="grid2">
        {detailFields.map((f) => (
          <div key={f.name}>
            <label className="f" htmlFor={idFor(f.name)}>
              {f.label}
              {f.labelHint ? (
                <>
                  {' '}
                  <small>{f.labelHint}</small>
                </>
              ) : null}
            </label>
            {f.kind === 'select' ? (
              <select {...fieldProps(f.name)}>
                <option value="" />
                {options[f.list].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...fieldProps(f.name)}
                type={f.type ?? 'text'}
                placeholder={f.placeholder}
                autoComplete={f.autoComplete}
              />
            )}
            {serverLine(f.name)}
          </div>
        ))}
      </div>

      <div className="warn">
        <b>{copy.detailsNotice.lead}</b>
        {copy.detailsNotice.body}
      </div>

      <ErrorLine message={detailsMessage(problems, detailFields, copy.detailsError)} />
      <StepRow onBack={onBack}>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={next}>
          Continue
        </button>
      </StepRow>
    </FormShell>
  );
}

export default DetailsStep;
