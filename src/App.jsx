import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import Home from './pages/Home';
import { ToastProvider } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/confirm-dialog';
import { DarkModeProvider } from './contexts/DarkModeContext';
import ErrorBoundary from './components/ErrorBoundary';
import { useServiceWorker } from './hooks/useServiceWorker';
import { RefreshCw } from 'lucide-react';

// Home stays eagerly imported — it is the landing page, and deferring it would
// only add a round trip to first paint. Every other route is split out, so the
// heavyweight dependencies they pull in (Recharts via the solver, jsPDF via the
// export menus) are no longer downloaded by visitors who never open them.
const Solver = lazy(() => import('./pages/Solver'));
const Progress = lazy(() => import('./pages/Progress'));
const UserManual = lazy(() => import('./pages/UserManual'));
const FAQ = lazy(() => import('./pages/FAQ'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const Feedback = lazy(() => import('./pages/Feedback'));
const Settings = lazy(() => import('./pages/Settings'));

// Shown while a route chunk is in flight. Deliberately quiet: the sidebar and
// header are already painted by Layout, so a spinner in the content area is
// enough to signal progress without the page appearing to reload.
function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <span className="sr-only">Loading page...</span>
    </div>
  );
}

function UpdateBanner({ updateAvailable, applyUpdate }) {
  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce-in">
      <RefreshCw className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm font-medium">A new version of MasterMath is available!</span>
      <button
        onClick={applyUpdate}
        className="bg-white text-indigo-700 px-3 py-1 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors"
      >
        Update
      </button>
    </div>
  );
}

function AppContent() {
  const { updateAvailable, applyUpdate } = useServiceWorker();

  return (
    <>
      <Router>
        <Layout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/solver" element={<Solver />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/usermanual" element={<UserManual />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/privacypolicy" element={<PrivacyPolicy />} />
              <Route path="/termsofservice" element={<TermsOfService />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
      <UpdateBanner updateAvailable={updateAvailable} applyUpdate={applyUpdate} />
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
