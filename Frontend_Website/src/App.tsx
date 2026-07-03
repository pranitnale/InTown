import React, { useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import TripSetup from './components/TripSetup';
import TripStep2 from './components/TripStep2';
import PreferencesStep1 from './components/PreferencesStep1';
import PreferencesStep2 from './components/PreferencesStep2';
import PlanGenerating from './components/PlanGenerating';
import PlanView from './components/PlanView';
import { registerServiceWorker } from './utils/pwa';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

const AppContent: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  const hideHeader = location.pathname === '/' || location.pathname === '/plan' || location.pathname === '/navigating';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {!hideHeader && <Header />}
      <div className={hideHeader ? '' : 'pt-16'}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/tripsetup" element={<TripSetup />} />
          <Route path="/setup2" element={<TripStep2 />} />
          <Route path="/preferences1" element={<PreferencesStep1 />} />
          <Route path="/preferences2" element={<PreferencesStep2 />} />
          <Route path="/generating" element={<PlanGenerating />} />
          <Route path="/plan" element={<PlanView />} />
          <Route path="/navigating" element={<PlanView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
