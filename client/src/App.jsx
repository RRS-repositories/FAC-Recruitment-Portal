import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { RoleLandingPage } from '@/pages/RoleLandingPage';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import {
  SALES_APPLY_PATH,
  SALES_APPLY_REDIRECTS,
  SALES_APPLY_SEGMENT,
  SALES_PATH,
  SALES_REDIRECTS,
} from '@/features/sales/paths';

// The application flow, dashboard and booking page are each reached
// deliberately rather than browsed to, so they are split out and never weigh
// down the landing pages a candidate arrives on.
const ApplyPage = lazy(() => import('@/pages/ApplyPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const BookingPage = lazy(() => import('@/pages/BookingPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
// Sales & Customer Service (South Africa) has its own page, form and
// stylesheet, all in features/sales/ and all in this one chunk.
const SalesPage = lazy(() => import('@/features/sales/SalesPage'));

/** Holds the fold while a split chunk arrives, so nothing jumps. */
function RouteFallback() {
  return <div className="min-h-[70vh]" aria-hidden="true" />;
}

const split = (Component) => (
  <Suspense fallback={<RouteFallback />}>
    <Component />
  </Suspense>
);

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* Each role has its own URL — the link that goes on a job board.
            Under /recruitment so the whole candidate journey sits at one path
            on the main site: /recruitment/intern and /recruitment/paralegal. */}
        {/* Before the :roleKey route, or "privacy" would be read as a role. */}
        <Route path="/recruitment/privacy" element={split(PrivacyPage)} />
        {/* Also before :roleKey and apply/:roleKey: sales has its own page.
            Its URL lives only in features/sales/paths.js; the redirects keep
            /recruitment/apply/sales (and the old address, should the URL ever
            move) from reaching the other roles' page and form. */}
        {/* The landing and the form share one SalesPage, which stays mounted
            between them (the children render nothing of their own). */}
        <Route path={SALES_PATH} element={split(SalesPage)}>
          <Route index element={null} />
          <Route path={SALES_APPLY_SEGMENT} element={null} />
        </Route>
        {SALES_REDIRECTS.map((path) => (
          <Route key={path} path={path} element={<Navigate to={SALES_PATH} replace />} />
        ))}
        {SALES_APPLY_REDIRECTS.map((path) => (
          <Route key={path} path={path} element={<Navigate to={SALES_APPLY_PATH} replace />} />
        ))}
        <Route path="/recruitment/:roleKey" element={<RoleLandingPage />} />
        <Route path="/recruitment/apply/:roleKey" element={split(ApplyPage)} />

        {/* Both, deliberately. Links already sent point at /book/:token, and
            a booking link that stops working is a candidate who cannot attend.
            The one in new emails follows PUBLIC_BASE_URL. */}
        <Route path="/book/:token" element={split(BookingPage)} />
        <Route path="/recruitment/book/:token" element={split(BookingPage)} />
        <Route path="/admin" element={split(DashboardPage)} />
        <Route path="/admin/templates" element={split(TemplatesPage)} />
        <Route path="/admin/calendar" element={split(CalendarPage)} />
        <Route path="/admin/settings" element={split(SettingsPage)} />

        {/* The shapes these pages used to have. Kept working rather than
            404ing anyone who saved a link or printed one on something.
            `/roles/:roleKey` never worked — it navigated to the literal string
            ":roleKey" and fell through to the home page. */}
        <Route path="/india" element={<Navigate to="/recruitment/intern" replace />} />
        <Route path="/south-africa" element={<Navigate to="/recruitment/paralegal" replace />} />
        <Route path="/apply/india" element={<Navigate to="/recruitment/apply/intern" replace />} />
        <Route
          path="/apply/south-africa"
          element={<Navigate to="/recruitment/apply/paralegal" replace />}
        />
        <Route path="/roles/india" element={<Navigate to="/recruitment/intern" replace />} />
        <Route
          path="/roles/south-africa"
          element={<Navigate to="/recruitment/paralegal" replace />}
        />
        <Route path="/recruitment" element={<Navigate to="/" replace />} />

        {/* Reachable again. While role pages sat at "/:roleKey" this route was
            shadowed, so every unknown URL rendered the home page — which is
            also why the privacy link silently showed a job advert. */}
        <Route path="*" element={split(NotFoundPage)} />
      </Routes>
    </>
  );
}
