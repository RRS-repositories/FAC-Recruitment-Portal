import { useMemo, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import Icon from '@/components/ui/Icon';
import { roleTypes, headcountOptions } from '@/data/enquire';
import { validators, validateAll } from '@/utils/validators';

const ENDPOINT = '/api/enquiries';

const INITIAL_VALUES = {
  name: '',
  company: '',
  email: '',
  phone: '',
  roleType: '',
  headcount: '1',
  message: '',
};

const FIELD_LABELS = {
  name: 'Your name',
  email: 'Email',
  company: 'Company',
  phone: 'Phone',
  roleType: 'Role type',
  headcount: 'How many people',
  message: 'About the role',
};

const controlClass =
  'w-full rounded-md border-[1.5px] bg-[#fafbfc] px-3.5 py-3 text-[0.92rem] text-ink ' +
  'transition-colors duration-200 focus:bg-white focus:outline-none';

/** Label + control + error, wired together with the ids screen readers need. */
function Field({ id, label, error, children, className }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.8rem] font-semibold text-navy">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[0.78rem] font-medium text-[#b3261e]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function EnquiryForm() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const summaryRef = useRef(null);

  // Bot checks, invisible to a real visitor. `website` is a field no human can
  // reach; `renderedAt` lets the server tell a typed submission from an
  // instant one. Both are read server-side — neither is enforced here, because
  // anything enforced in the browser can simply be skipped.
  const renderedAt = useMemo(() => Date.now(), []);
  const [honeypot, setHoneypot] = useState('');

  const setField = (field) => (event) => {
    const { value } = event.target;
    setValues((previous) => ({ ...previous, [field]: value }));
    // Clear an existing error as soon as the user fixes it; don't introduce a
    // new one mid-keystroke.
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const message = validators[field]?.(value) ?? '';
      if (message) return previous;
      const { [field]: _removed, ...rest } = previous;
      return rest;
    });
  };

  // Validate on blur, once the user has finished with the field.
  const validateField = (field) => (event) => {
    const message = validators[field]?.(event.target.value) ?? '';
    setErrors((previous) => {
      if (!message) {
        const { [field]: _removed, ...rest } = previous;
        return rest;
      }
      return { ...previous, [field]: message };
    });
  };

  const focusSummary = () => requestAnimationFrame(() => summaryRef.current?.focus());

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;

    setSubmitError('');
    const nextErrors = validateAll(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      // Move focus to the summary so keyboard and screen-reader users land on
      // the problem rather than having to hunt for it.
      focusSummary();
      return;
    }

    setSending(true);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, website: honeypot, renderedAt }),
      });

      if (response.ok) {
        setSubmitted(true);
        return;
      }

      // A 400 carries per-field messages; map them straight onto the same UI
      // that shows client-side errors, so a server rejection looks identical.
      const payload = await response.json().catch(() => ({}));
      if (response.status === 400 && payload.errors) {
        setErrors(payload.errors);
      } else {
        setSubmitError(
          payload.error ||
            'We could not send your enquiry just now. Please try again, or email us directly.',
        );
      }
      focusSummary();
    } catch {
      // Offline, DNS failure, the service being restarted — the user's typed
      // values are deliberately left untouched so nothing has to be retyped.
      setSubmitError(
        'We could not reach our servers. Check your connection and try again, or email us directly.',
      );
      focusSummary();
    } finally {
      setSending(false);
    }
  };

  const errorEntries = Object.entries(errors);

  const fieldProps = (field) => ({
    id: field,
    name: field,
    value: values[field],
    onChange: setField(field),
    onBlur: validators[field] ? validateField(field) : undefined,
    'aria-invalid': errors[field] ? 'true' : undefined,
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
    className: cn(
      controlClass,
      errors[field] ? 'border-[#b3261e] focus:border-[#b3261e]' : 'border-[#dfe3ea] focus:border-gold',
    ),
  });

  if (submitted) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center rounded-card bg-white px-8 py-14 text-center text-ink"
      >
        <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-navy">
          <Icon name="check" size={28} strokeWidth={2.5} />
        </span>
        <h3 className="mb-2 font-display text-[1.4rem] text-navy">Request received</h3>
        <p className="max-w-sm text-[0.95rem] text-muted">
          Thanks — we&rsquo;ll be in touch within one working day.
        </p>
        <button
          type="button"
          onClick={() => {
            setValues(INITIAL_VALUES);
            setErrors({});
            setSubmitError('');
            setHoneypot('');
            setSubmitted(false);
          }}
          className="mt-7 rounded-md border-[1.5px] border-navy px-6 py-3 text-[0.9rem] font-semibold text-navy transition-colors duration-200 hover:border-gold hover:text-gold"
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-card bg-white p-6 text-ink sm:p-9"
    >
      {errorEntries.length > 0 || submitError ? (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          aria-labelledby="enquiry-error-title"
          className="rounded-md border-[1.5px] border-[#b3261e] bg-[#fdf3f2] px-4 py-3.5"
        >
          <h3 id="enquiry-error-title" className="text-[0.9rem] font-bold text-[#b3261e]">
            There is a problem
          </h3>

          {submitError ? (
            <p className="mt-2 text-[0.85rem] font-medium text-[#b3261e]">{submitError}</p>
          ) : null}

          {errorEntries.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {errorEntries.map(([field, message]) => (
                <li key={field}>
                  <a
                    href={`#${field}`}
                    onClick={(event) => {
                      event.preventDefault();
                      document.getElementById(field)?.focus();
                    }}
                    className="text-[0.85rem] font-medium text-[#b3261e] underline"
                  >
                    {FIELD_LABELS[field] ?? field}: {message}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Your name" error={errors.name}>
          <input type="text" autoComplete="name" placeholder="Jane Smith" {...fieldProps('name')} />
        </Field>
        <Field id="company" label="Company" error={errors.company}>
          <input
            type="text"
            autoComplete="organization"
            placeholder="Company name"
            {...fieldProps('company')}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="email" label="Email" error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            placeholder="jane@company.co.uk"
            {...fieldProps('email')}
          />
        </Field>
        <Field id="phone" label="Phone" error={errors.phone}>
          <input
            type="tel"
            autoComplete="tel"
            placeholder="+44 7700 000000"
            {...fieldProps('phone')}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="roleType" label="Role type" error={errors.roleType}>
          <select {...fieldProps('roleType')}>
            <option value="">Select…</option>
            {roleTypes.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </Field>
        <Field id="headcount" label="How many people?" error={errors.headcount}>
          <select {...fieldProps('headcount')}>
            {headcountOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="message" label="Tell us about the role" error={errors.message}>
        {(() => {
          const { className, ...rest } = fieldProps('message');
          return (
            <textarea
              rows={4}
              placeholder="Duties, skills, hours, start date — anything that helps us shortlist well."
              className={cn(className, 'min-h-[110px] resize-y')}
              {...rest}
            />
          );
        })()}
      </Field>

      {/* Honeypot. Hidden from sight, from the tab order and from assistive
          tech, so only an automated form-filler ever populates it. Not
          `display:none` — some bots skip those. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        aria-busy={sending}
        className="rounded-md bg-navy px-4 py-4 text-[0.97rem] font-semibold text-white transition-colors duration-200 hover:bg-slate-brand disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-navy"
      >
        {sending ? 'Sending…' : 'Send my request'}
      </button>

      <small className="text-center text-[0.75rem] text-muted">
        No obligation. We&rsquo;ll reply with a proposed market, cost band and timeline.
      </small>
    </form>
  );
}

export default EnquiryForm;
