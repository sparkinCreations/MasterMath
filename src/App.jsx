import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Home from './pages/Home';
import { ToastProvider } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/confirm-dialog';
import { DarkModeProvider } from './contexts/DarkModeContext';
import ErrorBoundary from './components/ErrorBoundary';
import { useServiceWorker } from './hooks/useServiceWorker';

// Home stays eagerly imported — it is the landing page, and deferring it would
// only add a round trip to first paint. Every other route is split out, so the
// heavyweight dependencies they pull in (Recharts via the solver, jsPDF via the
// export menus) are no longer downloaded by visitors who never open them.
const Solver = lazy(() => import('./pages/Solver'));
const Progress = lazy(() => import('./pages/Progress'));
const UserManual = lazy(() => import('./pages/UserManual'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Compare = lazy(() => import('./pages/Compare'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const Feedback = lazy(() => import('./pages/Feedback'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Shown while a route chunk is in flight. Deliberately quiet: the sidebar and
// header are already painted by Layout, so a spinner in the content area is
// enough to signal progress without the page appearing to reload. It is a
// screen tall so the footer starts below the fold: at ~200 px the footer
// painted mid-screen and jumped away when the page arrived (layout shift
// 0.176 on the Solver page on a throttled phone, October 2026).
function RouteFallback() {
  return (
    <div className="flex justify-center pt-24 min-h-screen" role="status" aria-live="polite">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <span className="sr-only">Loading page...</span>
    </div>
  );
}

function AppContent() {
  // A different version waiting shows as "Update available" beside the
  // version in the footer; the same version is switched to quietly.
  const update = useServiceWorker();

  return (
    <>
      <Router>
        <Layout update={update}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/solver" element={<Solver />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/usermanual" element={<UserManual />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/privacypolicy" element={<PrivacyPolicy />} />
              <Route path="/termsofservice" element={<TermsOfService />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/settings" element={<Settings />} />
              {/* Anything else — a mistyped or stale URL — goes home rather than
                  rendering an empty page. */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <DarkModeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppContent />
          </ConfirmProvider>
        </ToastProvider>
      </DarkModeProvider>
    </ErrorBoundary>
  );
}

export default App;
