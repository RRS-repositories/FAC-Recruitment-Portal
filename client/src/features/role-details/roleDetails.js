/**
 * Which expanded-row panel an applicant gets. Intern and paralegal return
 * null and keep ApplicantRow's own written-answers block, exactly as before.
 */
import { isSalesApplicant } from '../sales/dashboard/salesDetail.js';
import { isAiDevApplicant } from './aiDevDetail.js';

/** 'sales' | 'aidev' | null. */
export function roleDetailsKind(applicant) {
  if (isSalesApplicant(applicant)) return 'sales';
  if (isAiDevApplicant(applicant)) return 'aidev';
  return null;
}

export const hasRoleDetails = (applicant) => roleDetailsKind(applicant) !== null;
