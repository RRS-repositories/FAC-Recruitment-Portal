import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { fetchRole, startApplication } from '@/lib/api';
import { NOT_SENT_MESSAGE, noResponse, sendWithRetry } from '@/lib/submitRetry';
import { ROLES } from '@/data/roles';
import { submitRoleApplication } from './api';
import { emptyDetails, pickDetailOptions, stepForServerErrors } from './helpers';
import { FormShell, ErrorLine, StepRow } from './FormShell';
import { DetailsStep } from './steps/DetailsStep';
import { WrittenStep } from './steps/WrittenStep';
import { AssessmentStep } from './steps/AssessmentStep';
import { CvStep } from './steps/CvStep';
import { ThanksScreen } from './steps/ThanksScreen';

const LOAD_FAILED = 'We could not load the application form. Please refresh and try again.';

/**
 * A role page's multi-step application, on one URL, as the designs have it.
 *
 * Driven by the role's config (its steps, detail fields, copy, slug) plus
 * `extraSteps` — components for any step only that role has, keyed by page
 * (sales' `voice`). Their values are kept in `extras[page]` and handed to
 * the role's `appendExtras` when the form is built.
 *
 * Mounted when the candidate first reaches the form — which is when the
 * session opens and the questions load. It then stays mounted until "Back to
 * start", so stepping back to the landing page and in again keeps everything
 * already typed. All state lives here, not in the steps, so moving backwards
 * never loses anything.
 *
 * Nothing is scored here. The questions arrive with their weights stripped and
 * the server does the scoring — see data/roles.js for why.
 */
export function RoleApplication({ config, extraSteps = {}, onHome, onExit }) {
  const pages = useMemo(() => config.steps.map((s) => s.page), [config]);

  const [page, setPage] = useState(pages[0]);
  const [details, setDetails] = useState(() => emptyDetails(config.detailFields));
  const [written, setWritten] = useState({});
  const [answers, setAnswers] = useState({});
  const [extras, setExtras] = useState({});
  const [cv, setCv] = useState(null);

  const [role, setRole] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // The server's per-field refusals for the details step, and one message per
  // other step, shown on the step the candidate is sent back to.
  const [detailErrors, setDetailErrors] = useState({});
  const [stepMessages, setStepMessages] = useState({});
  const [acknowledged, setAcknowledged] = useState(false);

  const telemetry = useTelemetry();
  const titleRef = useRef(null);

  // The questions. Fetched, never bundled: they are the marking scheme's
  // other half. Retried from the error card without reloading the page, so
  // nothing typed is lost to a blip.
  useEffect(() => {
    let cancelled = false;
    setLoadError('');
    fetchRole(config.slug)
      .then((payload) => {
        if (!cancelled) setRole(payload?.role ?? payload);
      })
      .catch((error) => {
        if (cancelled) return;
        // A closed portal says so in its own words; anything else is generic.
        setLoadError(error?.payload?.disabled && error.payload.error ? error.payload.error : LOAD_FAILED);
      });
    return () => {
      cancelled = true;
    };
  }, [config.slug, loadAttempt]);

  // The session lets the server time the application itself. Failing to open
  // one never blocks applying — we only lose that measurement (and retries).
  useEffect(() => {
    let cancelled = false;
    startApplication(config.slug)
      .then((r) => {
        if (!cancelled) setSessionId(r.sessionId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [config.slug]);

  // Each page starts at the top, and focus moves to its heading so keyboard
  // and screen-reader users land on the new step.
  useEffect(() => {
    if (pages.includes(page)) telemetry.markStep(page);
    if (page === 'written') telemetry.enterWrittenStep();
    else telemetry.leaveWrittenStep();

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    titleRef.current?.focus({ preventScroll: true });
  }, [page, pages, telemetry]);

  const limits = useMemo(
    () => ({ ...config.defaultLimits, ...(role?.limits ?? {}) }),
    [config, role],
  );

  const detailOptions = useMemo(
    () => pickDetailOptions(role?.detailOptions, config.fallbackDetailOptions),
    [config, role],
  );

  const goTo = (target) => setPage(target);
  const pageIndex = pages.indexOf(page);
  // Back from the first step leaves for the landing page (its own address);
  // this component stays mounted there, so nothing typed is lost.
  const back = () => (pageIndex > 0 ? goTo(pages[pageIndex - 1]) : onExit?.());
  const next = () => {
    setStepMessages((m) => (m[page] ? { ...m, [page]: '' } : m));
    goTo(pages[Math.min(pageIndex + 1, pages.length - 1)]);
  };

  const submit = useCallback(async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      // Sent again only if the connection drops before any reply, and only
      // with a session — the server recognises a resend from the same one.
      const result = await sendWithRetry(
        () =>
          submitRoleApplication(config, {
            details,
            written,
            answers,
            telemetry: telemetry.snapshot(),
            sessionId,
            source: ROLES[config.rolesKey]?.source,
            captchaToken,
            cv,
            extras,
          }),
        { canRetry: Boolean(sessionId) },
      );
      setAcknowledged(result?.acknowledged === true);
      setPage('thanks');
    } catch (error) {
      const fieldErrors = error.payload?.errors;
      if (fieldErrors) {
        // The server disagreed with something the browser let through: show
        // it on the step that owns it rather than as a generic failure.
        const { page: target, message } = stepForServerErrors(fieldErrors, {
          detailNames: config.detailFields.map((f) => f.name),
          extraSteps: config.extraStepErrors,
        });
        if (target === 'details') setDetailErrors(fieldErrors);
        if (target === 'cv') setSubmitError(message);
        else setStepMessages((m) => ({ ...m, [target]: message }));
        setPage(target);
      } else {
        setSubmitError(noResponse(error) ? NOT_SENT_MESSAGE : error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [config, details, written, answers, telemetry, sessionId, captchaToken, cv, extras]);

  if (page === 'thanks') {
    return (
      <ThanksScreen
        ref={titleRef}
        firstName={details.fullName.trim().split(/\s+/)[0]}
        email={details.email}
        acknowledged={acknowledged}
        onHome={onHome}
      />
    );
  }

  const stepNumber = pageIndex;
  const needsQuestions = page === 'written' || page === 'assessment';

  if (loadError || (needsQuestions && !role)) {
    return (
      <FormShell
        ref={titleRef}
        step={stepNumber}
        title={loadError ? 'Something went wrong' : 'Loading…'}
        sub={loadError ? '' : 'Getting the questions ready.'}
      >
        {loadError ? <ErrorLine message={loadError} /> : <div className="loading" aria-busy="true" />}
        <StepRow onBack={back}>
          {loadError ? (
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              onClick={() => setLoadAttempt((n) => n + 1)}
            >
              Try again
            </button>
          ) : null}
        </StepRow>
      </FormShell>
    );
  }

  const common = { step: stepNumber, titleRef, onBack: back, onNext: next };

  switch (page) {
    case 'details':
      return (
        <DetailsStep
          {...common}
          values={details}
          onChange={setDetails}
          options={detailOptions}
          serverErrors={detailErrors}
          onClearServerError={(field) => setDetailErrors((e) => ({ ...e, [field]: undefined }))}
        />
      );
    case 'written':
      return (
        <WrittenStep
          {...common}
          questions={role.writtenQuestions ?? []}
          values={written}
          onChange={setWritten}
          telemetry={telemetry}
          serverMessage={stepMessages.written}
        />
      );
    case 'assessment':
      return (
        <AssessmentStep
          {...common}
          questions={role.questions ?? []}
          values={answers}
          onChange={setAnswers}
          serverMessage={stepMessages.assessment}
        />
      );
    case 'cv':
      return (
        <CvStep
          step={stepNumber}
          titleRef={titleRef}
          value={cv}
          onChange={setCv}
          limits={limits}
          submitting={submitting}
          submitError={submitError}
          captchaToken={captchaToken}
          onCaptchaToken={setCaptchaToken}
          onBack={back}
          onSubmit={submit}
        />
      );
    default: {
      // A step only this role has (sales' voice note).
      const Extra = extraSteps[page];
      return Extra ? (
        <Extra
          {...common}
          value={extras[page] ?? null}
          onChange={(value) => setExtras((x) => ({ ...x, [page]: value }))}
          limits={limits}
          serverMessage={stepMessages[page]}
        />
      ) : null;
    }
  }
}

export default RoleApplication;
