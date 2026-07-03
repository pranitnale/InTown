import React from 'react';
import { Moon, Sun, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const { theme, setTheme, resetApp } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const canGoBack = !(location.pathname === '/' || location.pathname === '/generating' || location.pathname === '/navigating');

  const handleBack = () => {
    if (location.pathname === '/tripsetup') {
      navigate('/');
    } else if (location.pathname === '/setup2') {
      navigate('/tripsetup');
    } else if (location.pathname === '/preferences2') {
      navigate('/preferences1');
    } else if (location.pathname === '/preferences1') {
      navigate('/setup2');
    } else if (location.pathname === '/plan') {
      navigate('/preferences1');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {canGoBack && (
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            InTown
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-gray-700" />
            ) : (
              <Sun className="w-5 h-5 text-gray-300" />
            )}
          </button>

          {(location.pathname === '/plan' || location.pathname === '/navigating') && (
            <button
              onClick={resetApp}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              New Trip
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
