import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { RoleLandingPage } from '@/pages/RoleLandingPage';
import { ScrollToTop } from '@/components/layout/ScrollToTop';

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

        {/* Each role has its own URL — the link that goes on a job board. */}
        <Route path="/:roleKey" element={<RoleLandingPage />} />
        <Route path="/apply/:roleKey" element={split(ApplyPage)} />

        <Route path="/book/:token" element={split(BookingPage)} />
        <Route path="/admin" element={split(DashboardPage)} />
        <Route path="/admin/templates" element={split(TemplatesPage)} />
        <Route path="/admin/calendar" element={split(CalendarPage)} />
        <Route path="/admin/settings" element={split(SettingsPage)} />

        {/* Legacy shape kept working rather than 404ing anyone who saved it. */}
        <Route path="/roles/:roleKey" element={<Navigate to="/:roleKey" replace />} />
        <Route path="*" element={split(NotFoundPage)} />
      </Routes>
    </>
  );
}
