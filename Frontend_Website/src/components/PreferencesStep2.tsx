import React, { useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Interest } from '../types';
import { useNavigate } from 'react-router-dom';

const defaultInterests = [
  'Architecture',
  'Art & Museums',
  'History',
  'Nature & Parks',
  'Food & Dining',
  'Shopping',
  'Nightlife',
  'Photography',
  'Local Culture',
  'Hidden Gems',
];

const PreferencesStep2: React.FC = () => {
  const { state, setTripConfig } = useApp();
  const navigate = useNavigate();
  const [interests, setInterests] = useState<Interest[]>(
    (state.tripConfig?.interests?.length ? state.tripConfig.interests : defaultInterests.map((name, index) => ({
      id: `interest-${index}`,
      name,
      priority: index,
      isCustom: false,
    })))
  );
  const [customInterest, setCustomInterest] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => setDraggedIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newInterests = [...interests];
    const draggedItem = newInterests[draggedIndex];
    newInterests.splice(draggedIndex, 1);
    newInterests.splice(index, 0, draggedItem);
    newInterests.forEach((i, idx) => { i.priority = idx; });
    setInterests(newInterests);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const addCustomInterest = () => {
    if (!customInterest.trim()) return;
    const newInterest: Interest = {
      id: `custom-${Date.now()}`,
      name: customInterest.trim(),
      priority: interests.length,
      isCustom: true,
    };
    setInterests([...interests, newInterest]);
    setCustomInterest('');
  };

  const removeInterest = (id: string) => {
    const filtered = interests.filter(i => i.id !== id);
    filtered.forEach((i, idx) => { i.priority = idx; });
    setInterests(filtered);
  };

  const handleNext = () => {
    if (!state.tripConfig) return navigate('/');
    setTripConfig({ ...state.tripConfig, interests });
    navigate('/generating');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Your Preferences</h1>
          <p className="text-gray-600 dark:text-gray-300">Step 2 of 2</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Interests</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Drag to reorder by priority.</p>

            <div className="space-y-2 mb-4">
              {interests.map((interest, index) => (
                <div
                  key={interest.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-move hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${draggedIndex === index ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <span className="text-gray-900 dark:text-white font-medium">{interest.name}</span>
                    {interest.isCustom && <span className="ml-2 text-xs text-blue-500 dark:text-blue-400">Custom</span>}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Priority {index + 1}</span>
                  {interest.isCustom && (
                    <button onClick={() => removeInterest(interest.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors">
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCustomInterest()}
                placeholder="Add custom interest..."
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button onClick={addCustomInterest} className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => navigate('/preferences1')} className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors">Back</button>
            <button onClick={handleNext} className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all">Generate Plan</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesStep2;


