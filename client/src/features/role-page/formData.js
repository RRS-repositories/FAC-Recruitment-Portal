/**
 * The multipart body for a role-page application.
 *
 * Kept apart from api.js (which imports through the `@/` alias) so the exact
 * field list can be tested under plain `node --test`.
 *
 * One request carrying every file, as the other roles do: an application can
 * never half-succeed with the answers stored and the CV (or a voice note)
 * lost.
 *
 * Field order is fixed: role, the role's detail fields in its own order, the
 * JSON parts, the session, the CV — then anything the role appends itself.
 */
export function buildRoleFormData(
  { slug, detailFields, appendExtras },
  { details, written, answers, telemetry, sessionId, source, captchaToken, cv, extras },
) {
  const form = new FormData();
  form.set('role', slug);

  for (const { name } of detailFields) form.set(name, details?.[name] ?? '');

  form.set('written', JSON.stringify(written ?? {}));
  form.set('answers', JSON.stringify(answers ?? {}));
  form.set('telemetry', JSON.stringify(telemetry ?? {}));

  if (sessionId) form.set('sessionId', sessionId);
  if (source) form.set('source', source);
  if (captchaToken) form.set('captchaToken', captchaToken);

  if (cv) form.set('cv', cv, cv.name);
  appendExtras?.(form, extras ?? {});

  return form;
}

export default buildRoleFormData;
