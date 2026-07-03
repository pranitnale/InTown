import React, { useEffect, useRef, useState } from 'react';
import { Navigation, ExternalLink } from 'lucide-react';
import { Stop, Location } from '../types';
import { useApp } from '../context/AppContext';

interface MapViewProps {
  stops: Stop[];
  currentLocation?: Location;
  onStopClick: (stop: Stop) => void;
}

const MapView: React.FC<MapViewProps> = ({ stops, currentLocation, onStopClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const { state } = useApp();
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current || stops.length === 0) return;

    const center = stops[0]?.location || { lat: 41.3851, lng: 2.1734 };
    const mapElement = mapRef.current;

    return () => {
    };
  }, [stops, currentLocation]);

  const handleStopClick = (stop: Stop) => {
    setSelectedMarker(stop.id);
    onStopClick(stop);
  };

  return (
    <div className="relative w-full h-full bg-gray-100 dark:bg-gray-800">
      <div ref={mapRef} className="w-full h-full">
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-100 to-green-100 dark:from-blue-900 dark:to-green-900">
          <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Navigation className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Map Preview
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Interactive map with real-time navigation would be displayed here using Google Maps API
            </p>
            <div className="space-y-3">
              {stops.slice(0, 3).map((stop, index) => (
                <button
                  key={stop.id}
                  onClick={() => handleStopClick(stop)}
                  className={`w-full p-4 text-left rounded-lg transition-all ${
                    selectedMarker === stop.id
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedMarker === stop.id ? 'bg-white text-blue-500' : 'bg-blue-500 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{stop.name}</div>
                      <div className={`text-sm ${
                        selectedMarker === stop.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {stop.arrivalTime} • {stop.category}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {stops.length > 3 && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                  +{stops.length - 3} more stops
                </div>
              )}
            </div>
            <a
              href={`https://www.google.com/maps/dir/${stops.map(s => `${s.location.lat},${s.location.lng}`).join('/')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Google Maps
            </a>
          </div>
        </div>
      </div>

      {currentLocation && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">Your Location</span>
        </div>
      )}
    </div>
  );
};

export default MapView;
