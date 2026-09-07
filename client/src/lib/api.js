/**
 * The single place the client talks to the API.
 *
 * Same-origin by design — nginx serves the build and proxies `/api` in
 * production, and vite.config.js mirrors that in development — so there is no
 * base URL to configure and CORS never has to exist anywhere.
 */

export class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const FRIENDLY = {
  0: 'We could not reach our servers. Check your connection and try again.',
  429: 'Too many attempts from this connection. Please wait a moment and try again.',
  503: 'We could not save that just now. Please try again shortly.',
};

async function request(path, { body, method = 'GET', headers } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      // FormData sets its own multipart boundary — setting Content-Type by
      // hand would corrupt the body.
      headers: body instanceof FormData ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(FRIENDLY[0], { status: 0 });
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      payload.error || FRIENDLY[response.status] || 'Something went wrong. Please try again.',
      { status: response.status, payload },
    );
  }
  return payload;
}

/** Role copy and the questions — with the marking weights stripped server-side. */
export const fetchRole = (slug) => request(`/recruit/roles/${slug}`);

/** Opens a session so the server can time the application itself. */
export const startApplication = (role) =>
  request('/recruit/applications/start', { method: 'POST', body: { role } });

/**
 * Submits the application.
 *
 * Multipart because it carries the CV. The JSON parts go as string fields,
 * which is what the server expects — one request, so a submission can never
 * half-succeed with the answers stored but the CV lost.
 */
export function submitApplication({ role, details, written, answers, telemetry, sessionId, cv, source }) {
  const form = new FormData();
  form.set('role', role);
  for (const [key, value] of Object.entries(details)) form.set(key, value ?? '');
  form.set('written', JSON.stringify(written));
  form.set('answers', JSON.stringify(answers));
  form.set('telemetry', JSON.stringify(telemetry));
  if (sessionId) form.set('sessionId', sessionId);
  if (source) form.set('source', source);
  if (cv) form.set('cv', cv, cv.name);

  return request('/recruit/applications', { method: 'POST', body: form });
}

export const apiHealth = () => request('/health');

export default request;
