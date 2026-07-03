import React, { useMemo } from 'react';
import { Clock, MapPin, Navigation as NavIcon } from 'lucide-react';
import { Stop } from '../types';

interface TimelineProps {
  stops: Stop[];
  onStopClick: (stop: Stop) => void;
  currentTime?: string;
}

const Timeline: React.FC<TimelineProps> = ({ stops, onStopClick, currentTime }) => {
  const { currentStop, nextStop, upcomingStops } = useMemo(() => {
    if (!currentTime) {
      return {
        currentStop: stops[0],
        nextStop: stops[1],
        upcomingStops: stops.slice(2),
      };
    }

    const now = new Date(`2000-01-01T${currentTime}`);
    let current = stops[0];
    let next = stops[1];
    let upcoming = stops.slice(2);

    for (let i = 0; i < stops.length; i++) {
      const stopTime = new Date(`2000-01-01T${stops[i].arrivalTime}`);
      if (now >= stopTime) {
        current = stops[i];
        next = stops[i + 1];
        upcoming = stops.slice(i + 2);
      } else {
        break;
      }
    }

    return { currentStop: current, nextStop: next, upcomingStops: upcoming };
  }, [stops, currentTime]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Itinerary</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {stops.length} stops planned
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {currentStop && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-500">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
              <NavIcon className="w-4 h-4" />
              NOW
            </div>
            <button
              onClick={() => onStopClick(currentStop)}
              className="w-full text-left group"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {currentStop.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-1">
                <Clock className="w-4 h-4" />
                {currentStop.arrivalTime} • {currentStop.dwellMinutes + currentStop.bufferMinutes} min
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                {currentStop.significance}
              </p>
            </button>
          </div>
        )}

        {nextStop && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border-b-2 border-green-500">
            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 mb-2">
              <Clock className="w-4 h-4" />
              NEXT
            </div>
            <button
              onClick={() => onStopClick(nextStop)}
              className="w-full text-left group"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                {nextStop.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-1">
                <Clock className="w-4 h-4" />
                {nextStop.arrivalTime} • {nextStop.dwellMinutes + nextStop.bufferMinutes} min
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                {nextStop.significance}
              </p>
            </button>
          </div>
        )}

        {upcomingStops.length > 0 && (
          <div className="p-4">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              UPCOMING
            </div>
            <div className="space-y-3">
              {upcomingStops.map((stop, index) => (
                <button
                  key={stop.id}
                  onClick={() => onStopClick(stop)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      {(currentStop ? 2 : 0) + (nextStop ? 1 : 0) + index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {stop.name}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <Clock className="w-3 h-3" />
                        {stop.arrivalTime}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        {stop.category}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Timeline;
