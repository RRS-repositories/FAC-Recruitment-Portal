/**
 * The multipart body for a sales application.
 *
 * Kept apart from api.js (which imports through the `@/` alias) so the exact
 * field list can be tested under plain `node --test`.
 *
 * One request carrying both files, as the other roles do: an application can
 * never half-succeed with the answers stored and the CV or voice note lost.
 */
export function buildSalesFormData({
  role,
  details,
  written,
  answers,
  telemetry,
  sessionId,
  source,
  captchaToken,
  cv,
  voice,
}) {
  const form = new FormData();
  form.set('role', role);

  form.set('fullName', details.fullName ?? '');
  form.set('email', details.email ?? '');
  form.set('phone', details.phone ?? '');
  form.set('city', details.city ?? '');
  form.set('qualification', details.qualification ?? '');
  form.set('experience', details.experience ?? '');
  form.set('heardFrom', details.heardFrom ?? '');
  form.set('noticePeriod', details.noticePeriod ?? '');

  form.set('written', JSON.stringify(written ?? {}));
  form.set('answers', JSON.stringify(answers ?? {}));
  form.set('telemetry', JSON.stringify(telemetry ?? {}));

  if (sessionId) form.set('sessionId', sessionId);
  if (source) form.set('source', source);
  if (captchaToken) form.set('captchaToken', captchaToken);

  if (cv) form.set('cv', cv, cv.name);
  if (voice?.file) {
    form.set('voice', voice.file, voice.file.name || 'voice-note.webm');
    form.set('voiceDuration', String(Math.max(0, Math.round(voice.duration || 0))));
    form.set('voiceSource', voice.source === 'uploaded' ? 'uploaded' : 'recorded');
  }

  return form;
}

export default buildSalesFormData;
