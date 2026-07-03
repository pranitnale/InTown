import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { DailyPlan } from '../types';

const PlanGenerating: React.FC = () => {
  const { setDailyPlan } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const generateMockPlan = () => {
      setTimeout(() => {
        const mockPlan: DailyPlan = {
          id: 'plan-1',
          date: '2025-10-17',
          sunrise: '07:15',
          sunset: '19:30',
          weather: {
            temp: 22,
            condition: 'Partly Cloudy',
            rainProbability: 20,
          },
          stops: [
            {
              id: 'stop-1',
              name: 'Sagrada Família',
              category: 'Architecture',
              location: { lat: 41.4036, lng: 2.1744 },
              arrivalTime: '09:30',
              dwellMinutes: 90,
              bufferMinutes: 10,
              significance: 'Gaudí\'s masterpiece and Barcelona\'s most iconic landmark',
              preferenceFit: 'Top priority: Architecture',
              citations: [
                { source: 'Official Website', timestamp: '2025-10-15', url: 'https://sagradafamilia.org' }
              ],
              officialLink: 'https://sagradafamilia.org',
              priority: 1,
              narrationScript: 'Welcome to the Sagrada Família, Antoni Gaudí\'s awe-inspiring basilica. Construction began in 1882 and continues today...',
            },
            {
              id: 'stop-2',
              name: 'La Boqueria Market',
              category: 'Food & Culture',
              location: { lat: 41.3818, lng: 2.1713 },
              arrivalTime: '11:45',
              dwellMinutes: 60,
              bufferMinutes: 10,
              significance: 'Historic public market with vibrant local food scene',
              preferenceFit: 'Matches: Food & Dining, Local Culture',
              citations: [
                { source: 'Barcelona Tourism', timestamp: '2025-10-14', url: 'https://barcelonaturisme.com' }
              ],
              officialLink: 'https://boqueria.barcelona',
              priority: 2,
            },
            {
              id: 'stop-3',
              name: 'Park Güell',
              category: 'Nature & Architecture',
              location: { lat: 41.4145, lng: 2.1527 },
              arrivalTime: '13:30',
              dwellMinutes: 75,
              bufferMinutes: 10,
              significance: 'Gaudí\'s whimsical park with stunning city views',
              preferenceFit: 'Matches: Architecture, Nature & Parks, Photography',
              citations: [
                { source: 'Park Güell Official', timestamp: '2025-10-15', url: 'https://parkguell.barcelona' }
              ],
              officialLink: 'https://parkguell.barcelona',
              priority: 1,
            },
            {
              id: 'stop-4',
              name: 'Gothic Quarter',
              category: 'History',
              location: { lat: 41.3828, lng: 2.1761 },
              arrivalTime: '15:45',
              dwellMinutes: 90,
              bufferMinutes: 10,
              significance: 'Medieval heart of Barcelona with Roman ruins',
              preferenceFit: 'Matches: History, Hidden Gems',
              citations: [
                { source: 'Barcelona Tourism', timestamp: '2025-10-14', url: 'https://barcelonaturisme.com' }
              ],
              priority: 2,
            },
            {
              id: 'stop-5',
              name: 'Barceloneta Beach',
              category: 'Nature',
              location: { lat: 41.3806, lng: 2.1896 },
              arrivalTime: '17:45',
              dwellMinutes: 60,
              bufferMinutes: 10,
              significance: 'Popular beach with sunset views and waterfront dining',
              preferenceFit: 'Matches: Nature & Parks, Photography',
              citations: [
                { source: 'Barcelona Tourism', timestamp: '2025-10-14', url: 'https://barcelonaturisme.com' }
              ],
              priority: 3,
            },
          ],
          routes: [
            {
              from: 'stop-1',
              to: 'stop-2',
              mode: 'transit',
              color: '#2196f3',
              coordinates: [
                { lat: 41.4036, lng: 2.1744 },
                { lat: 41.3818, lng: 2.1713 },
              ],
            },
            {
              from: 'stop-2',
              to: 'stop-3',
              mode: 'walking',
              color: '#4caf50',
              coordinates: [
                { lat: 41.3818, lng: 2.1713 },
                { lat: 41.4145, lng: 2.1527 },
              ],
            },
            {
              from: 'stop-3',
              to: 'stop-4',
              mode: 'transit',
              color: '#2196f3',
              coordinates: [
                { lat: 41.4145, lng: 2.1527 },
                { lat: 41.3828, lng: 2.1761 },
              ],
            },
            {
              from: 'stop-4',
              to: 'stop-5',
              mode: 'walking',
              color: '#4caf50',
              coordinates: [
                { lat: 41.3828, lng: 2.1761 },
                { lat: 41.3806, lng: 2.1896 },
              ],
            },
          ],
        };

        setDailyPlan(mockPlan);
        navigate('/plan');
      }, 3000);
    };

    generateMockPlan();
  }, [setDailyPlan, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Crafting Your Perfect Day
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Researching top spots and optimizing your route...
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-100"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-200"></div>
        </div>
      </div>
    </div>
  );
};

export default PlanGenerating;
