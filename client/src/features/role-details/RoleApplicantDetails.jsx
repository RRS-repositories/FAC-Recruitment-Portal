import { SalesApplicantDetails } from '@/features/sales/dashboard/SalesApplicantDetails';
import { AiDevApplicantDetails } from './AiDevApplicantDetails';
import { roleDetailsKind } from './roleDetails';

const PANEL = { sales: SalesApplicantDetails, aidev: AiDevApplicantDetails };

/**
 * The expanded-row panel for a role that asks its own questions. ApplicantRow
 * draws this only when `hasRoleDetails(applicant)` is true; a role with no
 * panel here renders nothing.
 */
export function RoleApplicantDetails({ applicant, ...props }) {
  const Panel = PANEL[roleDetailsKind(applicant)];
  return Panel ? <Panel applicant={applicant} {...props} /> : null;
}

export default RoleApplicantDetails;
