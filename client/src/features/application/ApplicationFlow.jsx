import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useTelemetry } from '@/hooks/useTelemetry';
import { scoreApplication } from '@/lib/scoring';
import { detectAiUse } from '@/lib/aiDetect';
import { DetailsStep, validateDetails } from './steps/DetailsStep';
import { WrittenStep } from './steps/WrittenStep';
import { AssessmentStep } from './steps/AssessmentStep';
import { CvStep } from './steps/CvStep';

const STEPS = ['details', 'written', 'assessment', 'cv'];

const EMPTY_DETAILS = { fullName: '', email: '', phone: '', city: '' };

/**
 * The four-step application.
 *
 * State lives here rather than in each step, so moving backwards never loses
 * what someone has typed — the single most annoying way a form like this can
 * fail. Steps stay presentational and are easy to reorder or extend.
 *
 * Submission is mocked: it waits, then shows the confirmation. The computed
 * score and AI verdict are logged rather than displayed, because the candidate
 * must never see either.
 */
export function ApplicationFlow({ role, onExit }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [detailErrors, setDetailErrors] = useState({});
  const [written, setWritten] = useState({});
  const [answers, setAnswers] = useState({});
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const telemetry = useTelemetry();
  const startedAt = useMemo(() => Date.now(), []);
  const topRef = useRef(null);

  const step = STEPS[stepIndex];

  // Each step change moves focus to the new heading. Without this a keyboard
  // or screen-reader user stays where the old button was and has no idea the
  // page changed underneath them.
  useEffect(() => {
    telemetry.markStep(step);
    topRef.current?.focus();
    // Scrolling to the card top matters on mobile, where step 3 is long.
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step, telemetry]);

  useEffect(() => {
    if (step === 'written') telemetry.enterWrittenStep();
    else telemetry.leaveWrittenStep();
  }, [step, telemetry]);

  const back = useCallback(() => {
    if (stepIndex === 0) onExit?.();
    else setStepIndex((i) => i - 1);
  }, [stepIndex, onExit]);

  const next = useCallback(() => {
    if (step === 'details') {
      const errors = validateDetails(details);
      setDetailErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, [step, details]);

  const submit = useCallback(async () => {
    setSubmitError('');
    setSubmitting(true);

    const payload = {
      role: role.apiKey,
      ...details,
      written,
      answers,
      cvName: file?.name,
      startedAt,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      telemetry: telemetry.snapshot(),
    };

    // Mock: the real POST /api/recruit/applications lands in a later stage.
    // Scoring and AI detection are computed here to prove the shared logic
    // works end to end — the server recomputes both and its answer is the one
    // that counts.
    await new Promise((resolve) => setTimeout(resolve, 900));

    // eslint-disable-next-line no-console
    console.info('[mock submit]', {
      ...payload,
      score: scoreApplication(role.questions, answers),
      ai: detectAiUse(written, payload.telemetry),
    });

    setSubmitting(false);
    setDone(true);
  }, [role, details, written, answers, file, startedAt, telemetry]);

  if (done) {
    return (
      <Card className="mx-auto max-w-form text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-cta text-white"
        >
          <Icon name="check" size={28} strokeWidth={2.6} />
        </span>
        <h1 className="text-display-md font-extrabold text-ink">Application received</h1>
        <p className="mx-auto mt-3 max-w-md text-[0.95rem] leading-relaxed text-muted">
          Thanks {details.fullName.split(' ')[0]}. We&rsquo;ve sent a confirmation to{' '}
          <b className="font-semibold text-ink">{details.email}</b>. Our team reviews every
          application and will reply within 48 hours.
        </p>
        <p className="mt-5 rounded-panel bg-lav-soft px-4 py-3 text-[0.85rem] text-violet-deep">
          If you&rsquo;re shortlisted, your next email will include a link to book your interview
          at a time that suits you.
        </p>
        <div className="mt-7">
          <Button variant="secondary" onClick={onExit}>
            Back to the role
          </Button>
        </div>
      </Card>
    );
  }

  const shared = { role, onBack: back, onNext: next };

  return (
    <Card className="mx-auto max-w-form">
      {/* tabIndex -1 makes this focusable programmatically without adding it to
          the tab order for people who never leave the mouse. */}
      <div ref={topRef} tabIndex={-1} className="outline-none">
        <ProgressBar current={stepIndex + 1} total={STEPS.length} className="mb-7" />
      </div>

      {/* Keyed so React remounts on step change, which restarts the entrance
          animation and guarantees no state leaks between steps. */}
      <div key={step} className="animate-slide-in motion-reduce:animate-none">
        {step === 'details' && (
          <DetailsStep
            {...shared}
            values={details}
            errors={detailErrors}
            onChange={setDetails}
          />
        )}
        {step === 'written' && (
          <WrittenStep {...shared} answers={written} onChange={setWritten} telemetry={telemetry} />
        )}
        {step === 'assessment' && (
          <AssessmentStep {...shared} answers={answers} onChange={setAnswers} />
        )}
        {step === 'cv' && (
          <CvStep
            role={role}
            file={file}
            onFile={setFile}
            onBack={back}
            onSubmit={submit}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </div>
    </Card>
  );
}

export default ApplicationFlow;
