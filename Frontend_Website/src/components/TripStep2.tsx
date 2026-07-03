import React, { useState } from 'react';
import { Clock, Car, Users, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CompanionType, TransportMode, WalkingPreference } from '../types';
import { useNavigate } from 'react-router-dom';

const TripStep2: React.FC = () => {
  const { state, setTripConfig } = useApp();
  const existing = state.tripConfig;
  const navigate = useNavigate();

  const [companions, setCompanions] = useState<CompanionType>(existing?.companions ?? 'solo');
  const [transport, setTransport] = useState<TransportMode>(existing?.transport ?? 'public');
  const [walkingPreference, setWalkingPreference] = useState<WalkingPreference>(existing?.walkingPreference ?? 'medium');
  const [bufferTime, setBufferTime] = useState<number>(existing?.bufferTime ?? 10);

  const handleNext = () => {
    if (!existing) return navigate('/tripsetup');
    setTripConfig({
      ...existing,
      companions,
      transport,
      walkingPreference,
      bufferTime,
    });
    navigate('/preferences1');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <Users className="w-4 h-4" />
              Travel Companions
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['solo', 'couple', 'family', 'friends'] as CompanionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCompanions(type)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                    companions === type
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <Car className="w-4 h-4" />
              Transportation
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransport('public')}
                className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                  transport === 'public'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Public Transit
              </button>
              <button
                type="button"
                onClick={() => setTransport('car')}
                className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                  transport === 'car'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Rental Car
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <TrendingUp className="w-4 h-4" />
              Walking Preference
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as WalkingPreference[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setWalkingPreference(level)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                    walkingPreference === level
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <Clock className="w-4 h-4" />
              Buffer Time: {bufferTime} minutes
            </label>
            <input
              type="range"
              min="0"
              max="30"
              step="5"
              value={bufferTime}
              onChange={(e) => setBufferTime(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>No buffer</span>
              <span>Relaxed pace</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/tripsetup')}
              className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Continue to Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripStep2;


