import React, { useState } from 'react';
import { DollarSign, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BudgetLevel, RestaurantPreference } from '../types';
import { useNavigate } from 'react-router-dom';

const PreferencesStep1: React.FC = () => {
  const { state, setTripConfig } = useApp();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<BudgetLevel>(state.tripConfig?.budget ?? 'normal');
  const [restaurantPrefs, setRestaurantPrefs] = useState<RestaurantPreference[]>(state.tripConfig?.restaurantPreferences ?? ['everything']);

  const toggleRestaurantPref = (pref: RestaurantPreference) => {
    if (pref === 'everything') {
      setRestaurantPrefs(['everything']);
    } else {
      const filtered = restaurantPrefs.filter(p => p !== 'everything');
      if (filtered.includes(pref)) {
        const updated = filtered.filter(p => p !== pref);
        setRestaurantPrefs(updated.length === 0 ? ['everything'] : updated);
      } else {
        setRestaurantPrefs([...filtered, pref]);
      }
    }
  };

  const handleNext = () => {
    if (!state.tripConfig) return navigate('/');
    setTripConfig({
      ...state.tripConfig,
      budget,
      restaurantPreferences: restaurantPrefs,
    });
    navigate('/preferences2');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Your Preferences</h1>
          <p className="text-gray-600 dark:text-gray-300">Step 1 of 2</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 space-y-8">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-4">
              <DollarSign className="w-5 h-5" />
              Budget Level
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['free', 'low', 'normal', 'luxury'] as BudgetLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setBudget(level)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                    budget === level
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
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-4">
              <UtensilsCrossed className="w-5 h-5" />
              Dining Preferences
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(['everything', 'local', 'vegan', 'vegetarian', 'only_chicken', 'no_pork', 'no_beef'] as RestaurantPreference[]).map((pref) => (
                <button
                  key={pref}
                  onClick={() => toggleRestaurantPref(pref)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                    restaurantPrefs.includes(pref)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {pref.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => navigate('/setup2')}
              className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Next: Interests
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesStep1;


