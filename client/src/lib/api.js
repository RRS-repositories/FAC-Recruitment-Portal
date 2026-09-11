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
      headers:
        body instanceof FormData ? headers : { 'Content-Type': 'application/json', ...headers },
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
export function submitApplication({
  role,
  details,
  written,
  answers,
  telemetry,
  sessionId,
  cv,
  source,
  captchaToken,
}) {
  const form = new FormData();
  form.set('role', role);
  for (const [key, value] of Object.entries(details)) form.set(key, value ?? '');
  form.set('written', JSON.stringify(written));
  form.set('answers', JSON.stringify(answers));
  form.set('telemetry', JSON.stringify(telemetry));
  if (sessionId) form.set('sessionId', sessionId);
  if (source) form.set('source', source);
  if (cv) form.set('cv', cv, cv.name);
  if (captchaToken) form.set('captchaToken', captchaToken);

  return request('/recruit/applications', { method: 'POST', body: form });
}

/* ── Booking ──────────────────────────────────────────────────────────────
 * The token in the URL is the entire credential — the candidate has no
 * account and never signs in. So it is never put in a query string, where it
 * would end up in proxy and browser history logs; it stays in the path, which
 * the server matches against a stored hash.
 */

/** The slots on offer, plus who they are meeting. Bookable slots only. */
export const fetchBooking = (token) => request(`/recruit/book/${encodeURIComponent(token)}`);

/** Takes a slot. The server re-checks it — the list may be minutes stale. */
export const confirmBooking = (token, startsAt) =>
  request(`/recruit/book/${encodeURIComponent(token)}`, { method: 'POST', body: { startsAt } });

export const rescheduleBooking = (token, startsAt) =>
  request(`/recruit/book/${encodeURIComponent(token)}/reschedule`, {
    method: 'POST',
    body: { startsAt },
  });

export const cancelBooking = (token) =>
  request(`/recruit/book/${encodeURIComponent(token)}/cancel`, { method: 'POST' });

/* ── Admin ────────────────────────────────────────────────────────────────
 * The token is held in sessionStorage rather than localStorage: it should not
 * outlive the browser session, and an admin who closes the tab should be
 * signed out. It is short-lived and signed server-side, so a stale one simply
 * stops working rather than needing revocation.
 */
const TOKEN_KEY = 'fac.admin.token';

export const getAdminToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing, or storage blocked. Sign-in still works for this
    // page load; it just will not survive a refresh.
    return null;
  }
};

export const setAdminToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore — see above */
  }
};

const withAuth = (headers = {}) => {
  const token = getAdminToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
};

export async function adminSignIn(username, password) {
  const result = await request('/recruit/admin/session', {
    method: 'POST',
    body: { username, password },
  });
  setAdminToken(result.token);
  return result;
}

export const adminSignOut = () => setAdminToken(null);

/** Who the held token belongs to. Also the cheapest way to test it is still valid. */
export const adminMe = () => request('/recruit/admin/me', { headers: withAuth() });

export function adminApplications({ status, role, q, page = 1, from, to, sort, ai } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (role && role !== 'all') params.set('role', role);
  if (q) params.set('q', q);
  // Both are left off when they mean "no narrowing", so the request says only
  // what was actually asked for. The server ignores anything it does not
  // recognise rather than returning an empty list.
  if (sort) params.set('sort', sort);
  if (ai && ai !== 'all') params.set('ai', ai);
  // Half-typed dates are left off rather than sent: the server ignores them
  // anyway, and not sending them keeps the request honest about what it asked.
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('page', String(page));
  return request(`/recruit/admin/applications?${params}`, { headers: withAuth() });
}

export const adminApplication = (id) =>
  request(`/recruit/admin/applications/${id}`, { headers: withAuth() });

/**
 * Accept or decline.
 *
 * `why` is only meaningful on a decline — `{ reason, reasonNote }`, where the
 * note is used only when the reason is 'other'. Left off entirely for an
 * accept, so the request says only what was actually asked.
 */
export const adminDecide = (id, status, why) =>
  request(`/recruit/admin/applications/${id}`, {
    method: 'PATCH',
    body: why ? { status, reason: why.reason, reasonNote: why.reasonNote } : { status },
    headers: withAuth(),
  });

/**
 * A fresh booking link for an accepted applicant.
 *
 * The previous one stops working — which is the point when the reason for
 * reissuing is that the first went to the wrong address.
 */
export const adminReissueLink = (id) =>
  request(`/recruit/admin/applications/${id}/booking-link`, {
    method: 'POST',
    headers: withAuth(),
  });

/**
 * Every email the portal can send, rendered from sample data.
 *
 * Also reports whether mail is actually being delivered — the templates are
 * only half the question.
 */
export const adminTemplates = () => request('/recruit/admin/templates', { headers: withAuth() });

/**
 * The manager's calendar for a date range, as YYYY-MM-DD.
 *
 * The grid comes from the server already worked out — which instants make up
 * a working day across a clock change is arithmetic that should exist once,
 * and it already exists there.
 */
export const adminCalendar = (from, to) =>
  request(`/recruit/admin/calendar?from=${from}&to=${to}`, { headers: withAuth() });

/* ── The team (spec §8.1) ───────────────────────────────────────────────── */

/** Everyone with a login. Administrators only. */
export const adminTeam = () => request('/recruit/admin/team', { headers: withAuth() });

export const adminAddTeamMember = (body) =>
  request('/recruit/admin/team', { method: 'POST', body, headers: withAuth() });

/** Changes a role, deactivates, reactivates, or sets someone a new password. */
export const adminUpdateTeamMember = (id, body) =>
  request(`/recruit/admin/team/${id}`, { method: 'PATCH', body, headers: withAuth() });

/** Your own password. Everyone can change theirs; nobody could before. */
export const adminChangePassword = (currentPassword, newPassword) =>
  request('/recruit/admin/me/password', {
    method: 'PUT',
    body: { currentPassword, newPassword },
    headers: withAuth(),
  });

/* ── Settings (spec §8.3 and §2) ────────────────────────────────────────── */

/** The interviewer, their availability rules, their time off, and the flags. */
export const adminSettings = () => request('/recruit/admin/settings', { headers: withAuth() });

export const adminSaveAvailability = (body) =>
  request('/recruit/admin/settings/availability', { method: 'PUT', body, headers: withAuth() });

/**
 * Sends the candidate their video link, and saves it on the interview.
 *
 * Saving is the half that keeps working: both reminders resolve their merge
 * fields when they send, so they carry the link from here on.
 */
export const adminSendMeetingLink = (id, link) =>
  request(`/recruit/admin/applications/${id}/meeting-link`, {
    method: 'POST',
    body: { link },
    headers: withAuth(),
  });

/** The address the interviewer is told about bookings at. */
export const adminSaveInterviewer = (email) =>
  request('/recruit/admin/settings/interviewer', {
    method: 'PUT',
    body: { email },
    headers: withAuth(),
  });

/**
 * Marks a period unavailable.
 *
 * The response reports any interviews already booked inside it. They are not
 * cancelled — the screen shows them so a person can decide.
 */
export const adminAddBlackout = (body) =>
  request('/recruit/admin/settings/blackouts', { method: 'POST', body, headers: withAuth() });

export const adminRemoveBlackout = (id, interviewerId) =>
  request(`/recruit/admin/settings/blackouts/${id}?interviewerId=${interviewerId}`, {
    method: 'DELETE',
    headers: withAuth(),
  });

/** How long a declined applicant's CV is kept. 0 switches deletion off. */
export const adminSetRetention = (months) =>
  request('/recruit/admin/settings/retention', {
    method: 'PUT',
    body: { months },
    headers: withAuth(),
  });

/** Turns one feature flag on or off. */
export const adminSetFlag = (name, enabled) =>
  request(`/recruit/admin/settings/flags/${name}`, {
    method: 'PUT',
    body: { enabled },
    headers: withAuth(),
  });

/** Records whether the candidate turned up. */
export const adminMarkAttendance = (id, status) =>
  request(`/recruit/admin/applications/${id}/interview`, {
    method: 'PATCH',
    body: { status },
    headers: withAuth(),
  });

/** The CV needs the auth header, so it is fetched and handed over as a blob. */
export async function adminDownloadCv(id, filename) {
  const response = await fetch(`/api/recruit/admin/applications/${id}/cv`, { headers: withAuth() });
  if (!response.ok) throw new ApiError('Could not download that CV.', { status: response.status });

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'cv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
export const apiHealth = () => request('/health');

export default request;
