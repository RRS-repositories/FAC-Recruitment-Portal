import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import usePageMeta from '@/hooks/usePageMeta';
import { SalesLanding } from './SalesLanding';
import { SalesApplication } from './SalesApplication';
import { SALES_APPLY_PATH, SALES_PATH } from './paths';
import './sales.css';

/**
 * Route component for SALES_PATH and SALES_APPLY_PATH (see paths.js) — Sales
 * & Customer Service, South Africa. The landing is at SALES_PATH, the form at
 * SALES_APPLY_PATH.
 *
 * Loaded as its own lazy chunk from App.jsx, together with sales.css, so none
 * of this reaches a visitor to any other page. Everything renders inside the
 * `.fac-sales` root, which is what the stylesheet is scoped to.
 *
 * The page is the landing until "Start your application"; from then on the
 * application owns the screen (it can show the landing again itself, without
 * losing what was typed). "Back to start" after submitting remounts a fresh
 * one, as the design's reset does.
 */
export default function SalesPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onForm = pathname.replace(/\/+$/, '') === SALES_APPLY_PATH;

  // Mounted on first reaching the form -- including arriving at it directly --
  // and then KEPT mounted (just hidden) on the landing, so going back and in
  // again, by button or by the browser, keeps everything typed.
  const [started, setStarted] = useState(onForm);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (onForm) setStarted(true);
  }, [onForm]);

  usePageMeta({
    title: 'Sales & Customer Service — Fast Action Claims Careers',
    description:
      "Sales and customer service in South Africa with Fast Action Claims, one of the UK's fastest-growing law firms. UK hours, R6,000 basic, R13,000 OTE.",
  });

  // "Back to start" after submitting: a fresh form next time, as the design's
  // reset does.
  const home = () => {
    setStarted(false);
    setRun((n) => n + 1);
    navigate(SALES_PATH);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  return (
    <div className="fac-sales">
      {started ? (
        <div hidden={!onForm}>
          <SalesApplication key={run} onHome={home} onExit={() => navigate(SALES_PATH)} />
        </div>
      ) : null}
      {!onForm ? <SalesLanding onStart={() => navigate(SALES_APPLY_PATH)} /> : null}
    </div>
  );
}
