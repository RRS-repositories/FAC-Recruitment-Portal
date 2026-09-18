import { useRef, useState } from 'react';
import { Turnstile, captchaConfigured } from '@/components/ui/Turnstile';
import { FormShell, ErrorLine, StepRow } from '../FormShell';
import { useRoleConfig } from '../RoleContext';
import { readIntoMemory } from '../readIntoMemory';
import { CV_ACCEPT, checkCvFile, formatMB } from '../helpers';
import { RECRUIT_EMAIL } from '../content';

/**
 * The last step — the CV, the captcha, and Submit.
 *
 * The CV is copied into memory the moment it is chosen (readIntoMemory.js):
 * a phone can revoke the picked file's handle before Submit, and the upload
 * then fails with no reply at all.
 *
 * The captcha is the portal's own Turnstile component, placed as the other
 * roles place it; it renders nothing until a site key is configured.
 */
export function CvStep({
  step,
  value,
  onChange,
  limits,
  submitting,
  submitError,
  onCaptchaToken,
  captchaToken,
  onBack,
  onSubmit,
  titleRef,
}) {
  const { copy } = useRoleConfig();
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const inputRef = useRef(null);

  const pick = async (picked) => {
    if (!picked) return;
    const problem = checkCvFile(picked, { maxBytes: limits.cvMaxBytes });
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setReading(true);
    try {
      onChange(await readIntoMemory(picked));
    } catch {
      setError("We couldn't read that file. Please choose it again.");
    } finally {
      setReading(false);
    }
  };

  const waitingForCaptcha = captchaConfigured && !captchaToken;

  return (
    <FormShell
      ref={titleRef}
      step={step}
      title="Upload your CV"
      sub={copy.cvSub(limits.cvMaxBytes)}
    >
      <button
        type="button"
        className="drop"
        disabled={reading || submitting}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          pick(event.dataTransfer.files?.[0]);
        }}
      >
        <b>{reading ? 'Reading your CV…' : 'Choose your CV'}</b>
        <span>PDF, DOC or DOCX</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={CV_ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = '';
          pick(picked);
        }}
      />

      {value ? (
        <div className="filepill">
          <span>
            <span aria-hidden="true">📄</span> {value.name} · {formatMB(value.size)} MB
          </span>{' '}
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={submitting}
            title="Remove"
            aria-label="Remove CV"
          >
            ×
          </button>
        </div>
      ) : null}

      <Turnstile onToken={onCaptchaToken} className="turnstile-slot" />

      {/* One text run up to the address, as the design's markup has it: split
          into separate text nodes, the line shapes a pixel differently. */}
      <div className="warn info">
        {`${copy.cvConfirm} We'll email you from `}
        {RECRUIT_EMAIL} within 48 hours.
      </div>

      <ErrorLine message={error || submitError} />
      <StepRow onBack={onBack}>
        <button
          type="button"
          className="btn"
          style={{ flex: 1 }}
          disabled={!value || submitting || reading || waitingForCaptcha}
          onClick={onSubmit}
        >
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </StepRow>
      {value && waitingForCaptcha && !submitting ? (
        <div className="wc" style={{ textAlign: 'left' }}>
          Please tick the box above to confirm you are a person.
        </div>
      ) : null}
    </FormShell>
  );
}

export default CvStep;
