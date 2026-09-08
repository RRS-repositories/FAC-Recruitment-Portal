import { Field, TextInput } from '@/components/ui/Field';
import { StepHeader } from '../StepHeader';
import { StepNav } from '../StepNav';
import { Icon } from '@/components/ui/Icon';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDetails(values) {
  const errors = {};
  if (!values.fullName?.trim()) errors.fullName = 'Enter your full name';
  if (!values.email?.trim()) errors.email = 'Enter your email address';
  else if (!EMAIL.test(values.email.trim())) errors.email = 'Enter a valid email address';
  if (!values.phone?.trim()) errors.phone = 'Enter a phone number we can reach you on';
  return errors;
}

/**
 * Step 1 — who they are.
 *
 * The AI-use warning sits here, at the top of the flow, exactly as spec §13.1
 * requires: told before they write, not discovered afterwards. Being open
 * about the check is also the point — it deters more than it catches.
 */
/**
 * The notice lives in this app, at /recruitment/privacy. VITE_PRIVACY_URL
 * still wins if it is set, so a firm-wide policy page can replace ours
 * without a code change.
 */
const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL || '/recruitment/privacy';

export function DetailsStep({ role, values, errors, onChange, onBack, onNext }) {
  const set = (field) => (event) => onChange({ ...values, [field]: event.target.value });

  return (
    <>
      <StepHeader
        title="Your details"
        sub="We'll use these to contact you about your application. Nothing is shared outside our recruitment team."
      />

      <div
        className="mb-6 flex gap-3 rounded-panel border border-amber-200 bg-amber-50 p-4"
        role="note"
      >
        <Icon name="alert" size={18} className="mt-0.5 flex-shrink-0 text-amber-700" />
        <p className="text-[0.86rem] leading-relaxed text-amber-900">
          <strong className="font-semibold">Please answer in your own words.</strong> We use AI
          detection on every application. If your answers appear to have been written by ChatGPT or
          any other AI tool, your application will be discredited and will not be considered.
        </p>
      </div>

      <div className="grid gap-5">
        <Field label="Full name" required error={errors.fullName}>
          {(props) => (
            <TextInput
              {...props}
              value={values.fullName}
              onChange={set('fullName')}
              error={errors.fullName}
              autoComplete="name"
              placeholder="Your full name"
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email address" required error={errors.email}>
            {(props) => (
              <TextInput
                {...props}
                type="email"
                value={values.email}
                onChange={set('email')}
                error={errors.email}
                autoComplete="email"
                placeholder="you@example.com"
              />
            )}
          </Field>

          <Field label="Phone number" required error={errors.phone}>
            {(props) => (
              <TextInput
                {...props}
                type="tel"
                value={values.phone}
                onChange={set('phone')}
                error={errors.phone}
                autoComplete="tel"
                placeholder={role.countryCode === 'IN' ? '+91 …' : '+27 …'}
              />
            )}
          </Field>
        </div>

        <Field
          label="City"
          hint={`So we know which part of ${role.country} you're based in.`}
          error={errors.city}
        >
          {(props) => (
            <TextInput
              {...props}
              value={values.city}
              onChange={set('city')}
              autoComplete="address-level2"
              placeholder="City"
            />
          )}
        </Field>
      </div>

      {/* Spec §12: candidate data crosses India/South Africa to a UK server,
          so this has to be said before they hand it over.

          The link is conditional on purpose. It used to point at /privacy,
          which is not a route — it fell through to the role page and showed
          the careers home page instead. A promise of "how we handle your data"
          that delivers a job advert is worse than saying nothing, so until
          VITE_PRIVACY_URL is set the sentence stands on its own. */}
      <p className="mt-6 text-[0.78rem] leading-relaxed text-muted">
        Your application is processed in the United Kingdom. By continuing you consent to your
        details being stored and reviewed by our recruitment team, and to your CV being held while
        we consider it.
        {PRIVACY_URL ? (
          <>
            {' '}
            <a
              href={PRIVACY_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-violet-deep underline"
            >
              How we handle your data
            </a>
            .
          </>
        ) : null}
      </p>

      <StepNav onBack={onBack} onNext={onNext} />
    </>
  );
}

export default DetailsStep;
