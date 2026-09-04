import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import HomePage from '@/pages/HomePage';

// The home page is what almost every visitor lands on, so it ships in the main
// bundle. The secondary pages are split out and fetched on navigation.
const FounderPage = lazy(() => import('@/pages/FounderPage'));
const EnquirePage = lazy(() => import('@/pages/EnquirePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** Holds the fold while a split chunk loads — no layout jump on arrival. */
function RouteFallback() {
  return <div className="min-h-[70vh]" aria-hidden="true" />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route
          path="founder"
          element={
            <Suspense fallback={<RouteFallback />}>
              <FounderPage />
            </Suspense>
          }
        />
        <Route
          path="enquire"
          element={
            <Suspense fallback={<RouteFallback />}>
              <EnquirePage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <NotFoundPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
