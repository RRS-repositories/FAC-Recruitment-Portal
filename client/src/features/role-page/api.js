import request from '@/lib/api';
import { buildRoleFormData } from './formData';

/**
 * Submits a role-page application to `POST /api/recruit/applications/<slug>`.
 *
 * Each role has its own endpoint (sales carries a voice note, AI developer a
 * portfolio link — the generic intern/paralegal submit knows neither). Goes
 * through the portal's single `request` helper, so it is same-origin
 * (relative `/api/...`) like every other call and throws the same ApiError —
 * `status: 0` when nothing answered, which is what sendWithRetry looks for.
 */
export const submitRoleApplication = (config, fields) =>
  request(`/recruit/applications/${config.slug}`, {
    method: 'POST',
    body: buildRoleFormData(config, fields),
  });

export default submitRoleApplication;
