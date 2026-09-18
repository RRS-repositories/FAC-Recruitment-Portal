import { useState } from 'react';
import { FormShell, ErrorLine, StepRow } from '../FormShell';
import { VoiceRecorder } from '../VoiceRecorder';
import { minutesLabel } from '../helpers';

/**
 * Step 4 — the voice note. The design's prompts, then the recorder.
 *
 * Continue waits for a finished note and is held while a recording is still
 * running, so pressing it mid-take cannot silently carry the previous one
 * forward instead.
 */
export function VoiceStep({ value, onChange, limits, serverMessage, onBack, onNext, titleRef }) {
  const [recording, setRecording] = useState(false);

  return (
    <FormShell
      ref={titleRef}
      step={3}
      title="Your voice note"
      sub={`This is a phone job, so we want to hear you. Record up to ${minutesLabel(limits.voiceMaxSeconds)} telling us why you're the right person for this role.`}
    >
      <div className="prompts">
        <b>Cover these three things:</b>
        <ol>
          <li>Who you are and why you'd be an ideal candidate</li>
          <li>The sales or customer service experience you've had, with real examples</li>
          <li>Why you'd be the best person for this role at Fast Action Claims</li>
        </ol>
        <div className="prompts-note">
          Speak naturally, as you would on a call. Find a quiet spot. You can re-record as many
          times as you like before you continue.
        </div>
      </div>

      <VoiceRecorder
        value={value}
        onChange={onChange}
        limits={limits}
        onRecordingChange={setRecording}
      />

      <ErrorLine message={serverMessage} />
      <StepRow onBack={onBack}>
        <button
          type="button"
          className="btn"
          style={{ flex: 1 }}
          disabled={!value || recording}
          onClick={onNext}
        >
          Continue to CV
        </button>
      </StepRow>
    </FormShell>
  );
}

export default VoiceStep;
