import request from '@/lib/api';
import { buildSalesFormData } from './formData';

/**
 * Submits a sales application.
 *
 * Its own endpoint because it carries a voice note the other roles do not.
 * Goes through the portal's single `request` helper, so it is same-origin
 * (relative `/api/...`) like every other call and throws the same ApiError —
 * `status: 0` when nothing answered, which is what sendWithRetry looks for.
 */
export const submitSalesApplication = (fields) =>
  request('/recruit/applications/sales', { method: 'POST', body: buildSalesFormData(fields) });

export default submitSalesApplication;
