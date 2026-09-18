import { useState } from 'react';
import usePageMeta from '@/hooks/usePageMeta';
import { SalesLanding } from './SalesLanding';
import { SalesApplication } from './SalesApplication';
import './sales.css';

/**
 * Route component for SALES_PATH (see paths.js) — Sales & Customer Service,
 * South Africa.
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
  const [started, setStarted] = useState(false);
  const [run, setRun] = useState(0);

  usePageMeta({
    title: 'Sales & Customer Service — Fast Action Claims Careers',
    description:
      "Sales and customer service in South Africa with Fast Action Claims, one of the UK's fastest-growing law firms. UK hours, R6,000 basic, R13,000 OTE.",
  });

  const home = () => {
    setStarted(false);
    setRun((n) => n + 1);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  return (
    <div className="fac-sales">
      {started ? (
        <SalesApplication key={run} onHome={home} />
      ) : (
        <SalesLanding onStart={() => setStarted(true)} />
      )}
    </div>
  );
}
