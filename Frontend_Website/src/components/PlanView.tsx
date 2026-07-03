import React, { useState, useEffect } from 'react';
import { ThumbsUp, AlertCircle, RefreshCw, Sun, Cloud } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import MapView from './MapView';
import Timeline from './Timeline';
import StopPopup from './StopPopup';
import { Stop } from '../types';

const PlanView: React.FC = () => {
  const { state, setCurrentStep, setCurrentLocation } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedStop, setSelectedStop] = useState<Stop | undefined>();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);

    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
      );

      return () => {
        clearInterval(interval);
        navigator.geolocation.clearWatch(watchId);
      };
    }

    return () => clearInterval(interval);
  }, [setCurrentLocation]);

  if (!state.dailyPlan) return null;

  const handleLooksGood = () => {
    setCurrentStep('navigating');
    navigate('/navigating');
  };

  const handleSomethingMissing = () => {
    setShowFeedbackModal(true);
  };

  const handleReconfigure = () => {
    setCurrentStep('generating');
    navigate('/generating');
  };

  const handleNewPlan = () => {
    if (feedbackText.trim()) {
      setShowFeedbackModal(false);
      setFeedbackText('');
      setCurrentStep('generating');
      navigate('/generating');
    }
  };

  const { dailyPlan, currentLocation } = state;

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900">
      <div className="hidden md:flex md:flex-1 relative">
        <MapView
          stops={dailyPlan.stops}
          currentLocation={currentLocation}
          onStopClick={setSelectedStop}
        />
      </div>

      <div className="md:hidden h-64 relative">
        <MapView
          stops={dailyPlan.stops}
          currentLocation={currentLocation}
          onStopClick={setSelectedStop}
        />
      </div>

      <div className="flex-1 md:max-w-md lg:max-w-lg flex flex-col">
        {dailyPlan.weather && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {dailyPlan.weather.condition.includes('Cloud') ? (
                  <Cloud className="w-6 h-6" />
                ) : (
                  <Sun className="w-6 h-6" />
                )}
                <div>
                  <div className="text-2xl font-bold">{dailyPlan.weather.temp}°C</div>
                  <div className="text-sm opacity-90">{dailyPlan.weather.condition}</div>
                </div>
              </div>
              {dailyPlan.weather.rainProbability !== undefined && (
                <div className="text-right">
                  <div className="text-sm opacity-90">Rain chance</div>
                  <div className="text-lg font-semibold">{dailyPlan.weather.rainProbability}%</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <Timeline
            stops={dailyPlan.stops}
            onStopClick={setSelectedStop}
            currentTime={currentTime}
          />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          {(location.pathname === '/plan') ? (
            <div className="space-y-2">
              <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                How does this look?
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleLooksGood}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
                >
                  <ThumbsUp className="w-4 h-4" />
                  Looks Good
                </button>
                <button
                  onClick={handleSomethingMissing}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                  Something Missing
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleReconfigure}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reconfigure
              </button>
              <button
                onClick={() => navigate('/preferences1')}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                New Plan
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedStop && (
        <StopPopup stop={selectedStop} onClose={() => setSelectedStop(undefined)} />
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              What's missing?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Tell us what you'd like to add or change, and we'll create a new plan
            </p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="e.g., Add a hidden viewpoint near Old Town, prefer covered activities, no pork restaurants..."
              className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNewPlan}
                disabled={!feedbackText.trim()}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
              >
                Generate New Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanView;
