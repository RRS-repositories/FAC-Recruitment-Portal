import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import usePageMeta from '@/hooks/usePageMeta';
import { RoleContext } from './RoleContext';
import { RoleApplication } from './RoleApplication';
import './rolePage.css';

/**
 * The route component body for a role page: landing at `config.path`, the
 * application form at `config.applyPath` (see each role's paths.js).
 *
 * Each role's own page component (SalesPage, AiDevPage) renders this with its
 * config, its landing, any role-only steps and its own root class, and is
 * loaded as its own lazy chunk from App.jsx — so none of it reaches a visitor
 * to any other page. Everything renders inside the `.fac-role` root, which is
 * what rolePage.css is scoped to; `rootClass` adds the role's own class for
 * its role-only rules.
 *
 * The page is the landing until "Start your application"; from then on the
 * application owns the screen (it can show the landing again itself, without
 * losing what was typed). "Back to start" after submitting remounts a fresh
 * one, as the designs' reset does.
 */
export function RolePage({ config, Landing, extraSteps, rootClass }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onForm = pathname.replace(/\/+$/, '') === config.applyPath;

  // Mounted on first reaching the form -- including arriving at it directly --
  // and then KEPT mounted (just hidden) on the landing, so going back and in
  // again, by button or by the browser, keeps everything typed.
  const [started, setStarted] = useState(onForm);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (onForm) setStarted(true);
  }, [onForm]);

  usePageMeta(config.meta);

  // "Back to start" after submitting: a fresh form next time, as the designs'
  // reset does.
  const home = () => {
    setStarted(false);
    setRun((n) => n + 1);
    navigate(config.path);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  return (
    <RoleContext.Provider value={config}>
      <div className={rootClass ? `fac-role ${rootClass}` : 'fac-role'}>
        {started ? (
          <div hidden={!onForm}>
            <RoleApplication
              key={run}
              config={config}
              extraSteps={extraSteps}
              onHome={home}
              onExit={() => navigate(config.path)}
            />
          </div>
        ) : null}
        {!onForm ? <Landing onStart={() => navigate(config.applyPath)} /> : null}
      </div>
    </RoleContext.Provider>
  );
}

export default RolePage;
