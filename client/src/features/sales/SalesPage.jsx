import { RolePage } from '@/features/role-page/RolePage';
import { SalesLanding } from './SalesLanding';
import { VoiceStep } from './steps/VoiceStep';
import { SALES } from './config';
import './sales.css';

/** Sales' own step: the voice note, between the assessment and the CV. */
const EXTRA_STEPS = { voice: VoiceStep };

/**
 * Route component for SALES_PATH and SALES_APPLY_PATH (see paths.js) — Sales
 * & Customer Service, South Africa. The landing is at SALES_PATH, the form at
 * SALES_APPLY_PATH.
 *
 * The page, form and steps are the shared role-page kit
 * (features/role-page/), driven by config.js. What is sales' own is here:
 * the landing, the voice step and its recorder, and sales.css (the voice
 * rules, under the `.fac-sales` root class). Loaded as its own lazy chunk
 * from App.jsx, so none of this reaches a visitor to any other page.
 */
export default function SalesPage() {
  return <RolePage config={SALES} Landing={SalesLanding} extraSteps={EXTRA_STEPS} rootClass="fac-sales" />;
}
