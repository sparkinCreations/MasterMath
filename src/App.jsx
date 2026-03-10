import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import Home from './pages/Home';
import Solver from './pages/Solver';
import Progress from './pages/Progress';
import UserManual from './pages/UserManual';
import FAQ from './pages/FAQ';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Feedback from './pages/Feedback';
import { ToastProvider } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/confirm-dialog';
import { DarkModeProvider } from './contexts/DarkModeContext';
import ErrorBoundary from './components/ErrorBoundary';
import { useServiceWorker } from './hooks/useServiceWorker';
import { RefreshCw } from 'lucide-react';

function UpdateBanner({ updateAvailable, applyUpdate }) {
  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce-in">
      <RefreshCw className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm font-medium">A new version of MasterMath is available!</span>
      <button
        onClick={applyUpdate}
        className="bg-white text-purple-700 px-3 py-1 rounded-lg text-sm font-semibold hover:bg-purple-50 transition-colors"
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
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/solver" element={<Solver />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/usermanual" element={<UserManual />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/privacypolicy" element={<PrivacyPolicy />} />
            <Route path="/termsofservice" element={<TermsOfService />} />
            <Route path="/feedback" element={<Feedback />} />
          </Routes>
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
