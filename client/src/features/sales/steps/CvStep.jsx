import { useRef, useState } from 'react';
import { Turnstile, captchaConfigured } from '@/components/ui/Turnstile';
import { FormShell, ErrorLine, StepRow } from '../FormShell';
import { readIntoMemory } from '../readIntoMemory';
import { CV_ACCEPT, checkCvFile, formatMB, wholeMB } from '../helpers';
import { RECRUIT_EMAIL } from '../content';

/**
 * Step 5 — the CV, the captcha, and Submit.
 *
 * The CV is copied into memory the moment it is chosen (readIntoMemory.js):
 * a phone can revoke the picked file's handle before Submit, and the upload
 * then fails with no reply at all.
 *
 * The captcha is the portal's own Turnstile component, placed as the other
 * roles place it; it renders nothing until a site key is configured.
 */
export function CvStep({
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
      step={4}
      title="Upload your CV"
      sub={`Last step. PDF or Word, up to ${wholeMB(limits.cvMaxBytes)} MB.`}
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
          <span aria-hidden="true">📄</span> {value.name} · {formatMB(value.size)} MB{' '}
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

      <div className="warn info">
        By submitting you confirm your answers are your own work and that the information
        you&rsquo;ve given is accurate. We&rsquo;ll email you from {RECRUIT_EMAIL} within 48 hours.
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
