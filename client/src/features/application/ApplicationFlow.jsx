import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useTelemetry } from '@/hooks/useTelemetry';
import { fetchRole, startApplication, submitApplication } from '@/lib/api';
import { DetailsStep, validateDetails } from './steps/DetailsStep';
import { WrittenStep } from './steps/WrittenStep';
import { AssessmentStep } from './steps/AssessmentStep';
import { CvStep } from './steps/CvStep';

const STEPS = ['details', 'written', 'assessment', 'cv'];
const EMPTY_DETAILS = { fullName: '', email: '', phone: '', city: '' };
const DETAIL_FIELDS = ['fullName', 'email', 'phone', 'city'];

/**
 * The four-step application.
 *
 * State lives here rather than in each step, so moving backwards never loses
 * what someone has typed — the most annoying way a form like this can fail.
 *
 * The questions are fetched rather than bundled: they carry the marking
 * scheme, and shipping it to the browser would let a candidate read which
 * answer scores highest. The server sends them with the weights stripped and
 * does the scoring itself, so there is no score computed here at all.
 */
export function ApplicationFlow({ role, onExit }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [detailErrors, setDetailErrors] = useState({});
  const [written, setWritten] = useState({});
  const [answers, setAnswers] = useState({});
  const [file, setFile] = useState(null);

  const [questions, setQuestions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const telemetry = useTelemetry();
  const topRef = useRef(null);
  const step = STEPS[stepIndex];

  // Load the questions and open a session. The session is what lets the server
  // measure how long the application took rather than believing the browser.
  useEffect(() => {
    let cancelled = false;

    fetchRole(role.key)
      .then((payload) => {
        if (!cancelled) setQuestions(payload.role.questions);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('We could not load the application form. Please refresh and try again.');
        }
      });

    // A failed session is deliberately not fatal: the application still
    // submits, we just lose the server-side timing for it. Never block someone
    // from applying over a metric.
    startApplication(role.key)
      .then((r) => {
        if (!cancelled) setSessionId(r.sessionId);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [role.key]);

  // Each step change moves focus to the top of the card. Without it a keyboard
  // or screen-reader user stays where the old button was, with no idea the
  // page changed underneath them.
  useEffect(() => {
    telemetry.markStep(step);
    topRef.current?.focus();
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
    try {
      await submitApplication({
        role: role.key,
        details,
        written,
        answers,
        telemetry: telemetry.snapshot(),
        sessionId,
        cv: file,
        source: role.source,
      });
      setDone(true);
    } catch (error) {
      // A per-field rejection means the server disagreed with something the
      // browser let through. Show it against the field, and jump back to the
      // step that owns it, rather than reporting a generic failure.
      const fieldErrors = error.payload?.errors;
      if (fieldErrors) {
        setDetailErrors(fieldErrors);
        if (DETAIL_FIELDS.some((f) => fieldErrors[f])) setStepIndex(0);
        else if (fieldErrors.cv) setSubmitError(fieldErrors.cv);
        else setSubmitError('Some of your answers were not accepted. Please check them and try again.');
      } else {
        setSubmitError(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [role, details, written, answers, telemetry, sessionId, file]);

  if (loadError) {
    return (
      <Card className="mx-auto max-w-form text-center">
        <p role="alert" className="text-[0.95rem] font-medium text-danger">
          {loadError}
        </p>
        <div className="mt-5">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

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
      {/* tabIndex -1 so focus can be moved here on each step change without
          adding it to the tab order for anyone using a mouse. */}
      <div ref={topRef} tabIndex={-1} className="outline-none">
        <ProgressBar current={stepIndex + 1} total={STEPS.length} className="mb-7" />
      </div>

      {/* Keyed so React remounts on step change: the entrance animation
          restarts, and no state can leak between steps. */}
      <div key={step} className="animate-slide-in motion-reduce:animate-none">
        {step === 'details' && (
          <DetailsStep {...shared} values={details} errors={detailErrors} onChange={setDetails} />
        )}

        {step === 'written' && (
          <WrittenStep {...shared} answers={written} onChange={setWritten} telemetry={telemetry} />
        )}

        {step === 'assessment' &&
          (questions ? (
            <AssessmentStep {...shared} questions={questions} answers={answers} onChange={setAnswers} />
          ) : (
            // Skeletons rather than a spinner, so the layout does not jump when
            // the questions arrive.
            <div aria-busy="true" aria-label="Loading questions" className="grid gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 w-full" />
              ))}
            </div>
          ))}

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
