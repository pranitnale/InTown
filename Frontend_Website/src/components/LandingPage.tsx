import React from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-900">
      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs font-semibold">
          <MapPin className="w-4 h-4" />
          TRIP PLANNER
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Custom Trips Designed
          <br className="hidden md:block" />
          to Fit Your Budget
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-gray-600 dark:text-gray-300">
          Experience personalized travel planning like never before. Enter your budget and let us craft
          the perfect getaway tailored to your preferences.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/tripsetup')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg transition-colors"
          >
            Plan my trip
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
            className="px-5 py-3 rounded-full border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            See planning process
          </button>
        </div>
      </div>

      {/* Destinations bubbles (visual only) */}
      <div className="max-w-6xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { title: 'Rome, Italy', img: 'https://images.unsplash.com/photo-1549640376-5c1d7d2d6c4f?q=80&w=800&auto=format&fit=crop' },
            { title: 'Malé, Maldives', img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=800&auto=format&fit=crop' },
            { title: 'Serengeti, Tanzania', img: 'https://images.unsplash.com/photo-1534338580013-382cf48bd435?q=80&w=800&auto=format&fit=crop' },
          ].map((item) => (
            <div key={item.title} className="flex flex-col items-center">
              <div className="w-48 h-48 rounded-full overflow-hidden shadow-lg ring-4 ring-white dark:ring-gray-900">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover" />
              </div>
              <span className="mt-3 text-sm text-gray-700 dark:text-gray-300">{item.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Process section */}
      <div id="process" className="bg-white dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Tell us about you', desc: 'City, dates, companions, pace and preferences.' },
            { step: '2', title: 'We craft the plan', desc: 'Optimized route with timing, weather and citations.' },
            { step: '3', title: 'Approve & go', desc: 'Review, tweak, and navigate with live updates.' },
          ].map((card) => (
            <div key={card.step} className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold mb-3">
                {card.step}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{card.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingPage;


