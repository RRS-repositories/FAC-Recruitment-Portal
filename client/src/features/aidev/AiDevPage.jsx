import { RolePage } from '@/features/role-page/RolePage';
import { AiDevLanding } from './AiDevLanding';
import { AIDEV } from './config';
import './aidev.css';

/**
 * Route component for AIDEV_PATH and AIDEV_APPLY_PATH (see paths.js) — AI
 * Developer, India (remote). The landing is at AIDEV_PATH, the form at
 * AIDEV_APPLY_PATH.
 *
 * The page, the four-step form and its steps are the shared role-page kit
 * (features/role-page/), driven by config.js. What is this role's own is
 * here: the landing, its photo, and aidev.css (the hero tags and phone crop,
 * under the `.fac-aidev` root class). Loaded as its own lazy chunk from
 * App.jsx, so none of this reaches a visitor to any other page.
 */
export default function AiDevPage() {
  return <RolePage config={AIDEV} Landing={AiDevLanding} rootClass="fac-aidev" />;
}
