import { ExtendedApplicantDetails } from './ExtendedApplicantDetails';
import { AI_DEV_FIELDS } from './aiDevDetail';

/**
 * The AI developer applicant's part of the expanded dashboard row: the shared
 * panel with this role's profile fields. No voice note -- the role does not
 * ask for one.
 */
export function AiDevApplicantDetails({ detail, writtenQuestions, assessment }) {
  return (
    <ExtendedApplicantDetails
      detail={detail}
      writtenQuestions={writtenQuestions}
      assessment={assessment}
      fields={AI_DEV_FIELDS}
    />
  );
}

export default AiDevApplicantDetails;
