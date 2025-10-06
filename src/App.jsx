import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import Home from './pages/Home';
import Solver from './pages/Solver';
import Progress from './pages/Progress';
import UserManual from './pages/UserManual';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Feedback from './pages/Feedback';
import { ToastProvider } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/confirm-dialog';
import { DarkModeProvider } from './contexts/DarkModeContext';

function App() {
  return (
    <DarkModeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/solver" element={<Solver />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/usermanual" element={<UserManual />} />
                <Route path="/privacypolicy" element={<PrivacyPolicy />} />
                <Route path="/termsofservice" element={<TermsOfService />} />
                <Route path="/feedback" element={<Feedback />} />
              </Routes>
            </Layout>
          </Router>
        </ConfirmProvider>
      </ToastProvider>
    </DarkModeProvider>
  );
}

export default App;
