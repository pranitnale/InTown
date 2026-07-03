import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, TripConfig, DailyPlan, Location, Stop } from '../types';
import { Theme } from '../styles/colors';

interface AppContextType {
  state: AppState;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setCurrentStep: (step: AppState['currentStep']) => void;
  setTripConfig: (config: TripConfig) => void;
  setDailyPlan: (plan: DailyPlan) => void;
  setCurrentLocation: (location: Location) => void;
  setSelectedStop: (stop: Stop | undefined) => void;
  resetApp: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialState: AppState = {
  currentStep: 'setup',
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('intown-state');
    return saved ? JSON.parse(saved) : initialState;
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('intown-theme');
    if (saved) return saved as Theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('intown-state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem('intown-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setCurrentStep = (step: AppState['currentStep']) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const setTripConfig = (config: TripConfig) => {
    setState(prev => ({ ...prev, tripConfig: config }));
  };

  const setDailyPlan = (plan: DailyPlan) => {
    setState(prev => ({ ...prev, dailyPlan: plan }));
  };

  const setCurrentLocation = (location: Location) => {
    setState(prev => ({ ...prev, currentLocation: location }));
  };

  const setSelectedStop = (stop: Stop | undefined) => {
    setState(prev => ({ ...prev, selectedStop: stop }));
  };

  const resetApp = () => {
    setState(initialState);
    localStorage.removeItem('intown-state');
  };

  return (
    <AppContext.Provider
      value={{
        state,
        theme,
        setTheme,
        setCurrentStep,
        setTripConfig,
        setDailyPlan,
        setCurrentLocation,
        setSelectedStop,
        resetApp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
