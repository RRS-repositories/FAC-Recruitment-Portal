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
export function DetailsStep({ role, values, errors, onChange, onBack, onNext }) {
  const set = (field) => (event) => onChange({ ...values, [field]: event.target.value });

  return (
    <>
      <StepHeader
        eyebrow="About you"
        title="Let's start with your details"
        sub="We'll use these to contact you about your application. Nothing is shared outside our recruitment team."
        role={role}
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
                placeholder={role.key === 'india' ? '+91 …' : '+27 …'}
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

      <p className="mt-6 text-[0.78rem] leading-relaxed text-muted">
        Your application is processed in the United Kingdom. By continuing you consent to your
        details being stored and reviewed by our recruitment team.{' '}
        <a href="/privacy" className="font-medium text-violet-deep underline">
          How we handle your data
        </a>
        .
      </p>

      <StepNav onBack={onBack} onNext={onNext} />
    </>
  );
}

export default DetailsStep;
