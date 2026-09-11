/**
 * The seam between the API's vocabulary and the components'.
 *
 * The database speaks snake_case and role enum values (`india_intern`); the
 * components speak camelCase and route slugs (`india`), because that is what
 * `ROLES` is keyed by and what the URLs use. Translating in one place means no
 * component has to know both, and the two can be changed independently.
 *
 * Everything here also has to survive columns that are legitimately null — an
 * application with no interview yet, or one submitted before AI detection
 * populated its columns. A missing value becomes a sensible default rather
 * than an `undefined` that renders as blank or throws a row down.
 */

import { ROLES } from '@/data/roles';

/** `india_intern` → `india`. Derived from ROLES so a third role needs no edit. */
const SLUG_BY_API_KEY = Object.fromEntries(
  Object.values(ROLES).map((role) => [role.apiKey, role.key]),
);

/**
 * The same translation on its own, for callers that have a bare role value
 * rather than a whole row — the booking page gets one from the interview
 * record and needs the matching `ROLES` entry for its timezone label.
 */
export const roleFromApiKey = (apiKey) => ROLES[SLUG_BY_API_KEY[apiKey]] ?? null;

/** Reasons are stored as a JSON array; anything else is treated as none. */
const reasonsOf = (value) =>
  Array.isArray(value) ? value.filter((r) => typeof r === 'string') : [];

/**
 * One row from `GET /admin/applications`, or the fuller record from
 * `GET /admin/applications/:id` — the extra fields are simply absent on the
 * list, so `written` and `answers` stay null until a row is expanded.
 */
export function normaliseApplicant(row) {
  return {
    id: row.id,
    role: SLUG_BY_API_KEY[row.role] ?? row.role,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || '—',
    createdAt: row.created_at,

    // `final_score` is a generated column: the rule score today, the AI-adjusted
    // score once stage 8 populates it. Reading it here means the dashboard
    // switches over on its own.
    score: row.final_score ?? row.rule_score ?? 0,

    status: row.status,
    meetLink: row.meet_link ?? null,
    // No interview row at all is the commonest case, and it is not a null
    // state — it is "not invited", which the badge already knows how to draw.
    interviewStatus: row.interview_status ?? 'not_invited',
    interviewAt: row.interview_at ?? null,
    durationSec: row.duration_sec ?? null,

    ai: {
      // Passed through as it came, including missing. It used to default to
      // 'clean', which told a manager an application had been checked and was
      // fine when in truth it had not been checked at all -- a false
      // reassurance about the one thing this column exists to warn about.
      // `aiLevelLabel` renders anything unrecognised as "Not checked".
      level: row.ai_use_level ?? null,
      score: row.ai_use_score ?? 0,
      reasons: reasonsOf(row.ai_use_reasons),
    },

    cvFilename: row.cv_filename ?? null,
    // Set once the retention sweep has removed the file. The filename
    // survives so the row can say what is gone rather than show nothing.
    cvDeletedAt: row.cv_deleted_at ?? null,
    decidedByEmail: row.decided_by_email ?? null,
    decidedAt: row.decided_at ?? null,

    // Detail only.
    written: row.written_answers ?? null,
    answers: row.mcq_answers ?? null,
  };
}

/** The summary row, with the same snake_case → camelCase translation. */
export function normaliseSummary(summary = {}) {
  return {
    total: summary.total ?? 0,
    pending: summary.pending ?? 0,
    accepted: summary.accepted ?? 0,
    declined: summary.declined ?? 0,
    booked: summary.booked ?? 0,
    noShows: summary.no_shows ?? 0,
    aiFlagged: summary.ai_flagged ?? 0,
  };
}

export default normaliseApplicant;
