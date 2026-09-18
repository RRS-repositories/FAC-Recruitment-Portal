import { forwardRef } from 'react';
import { FormBand } from '../FormShell';
import { RECRUIT_EMAIL } from '../content';

/**
 * "Application received", as the design lays it out.
 *
 * One honest change: the confirmation email is only mentioned when the
 * server says one was sent (`acknowledged`). Telling somebody to watch for a
 * message nothing sends is how a candidate ends up assuming they were ignored
 * — the same rule the other roles' done screen follows.
 */
export const ThanksScreen = forwardRef(function ThanksScreen(
  { firstName, email, acknowledged, onHome },
  titleRef,
) {
  return (
    <div>
      <FormBand style={{ paddingBottom: 30 }} />
      <main className="wrap thanks">
        <div className="ok" aria-hidden="true">
          ✓
        </div>
        <h1 ref={titleRef} tabIndex={-1}>
          Application received
        </h1>
        <p>
          Thanks {firstName}. We've got your answers, your voice note and your CV
          {acknowledged ? (
            <>
              {' '}
              — and we've sent a confirmation to <b>{email}</b>
            </>
          ) : null}
          .
        </p>
        <p>
          You'll hear from us at <b>{RECRUIT_EMAIL}</b> within 48 hours. If you're
          shortlisted, the email will include a link to book a video interview at a time that suits
          you.
        </p>
        <p className="small">Check your junk folder just in case.</p>
        <button type="button" className="btn" style={{ marginTop: 20 }} onClick={onHome}>
          Back to start
        </button>
      </main>
    </div>
  );
});

export default ThanksScreen;
