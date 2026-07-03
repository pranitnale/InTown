 import React, { useState } from 'react';
import { MapPin, Calendar, Clock } from 'lucide-react';
import { TripConfig, CompanionType, TransportMode, WalkingPreference } from '../types';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const TripSetup: React.FC = () => {
  const { setTripConfig } = useApp();
  const navigate = useNavigate();
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [formData, setFormData] = useState({
    city: '',
    arrivalDate: '',
    arrivalTime: '09:00',
    returnDate: '',
    returnTime: '18:00',
    accommodationAddress: '',
    accommodationLat: 0,
    accommodationLng: 0,
    companions: 'solo' as CompanionType,
    transport: 'public' as TransportMode,
    walkingPreference: 'medium' as WalkingPreference,
    bufferTime: 10,
  });

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          accommodationLat: position.coords.latitude,
          accommodationLng: position.coords.longitude,
          accommodationAddress: 'Current Location',
        }));
        setUseCurrentLocation(true);
        setLoadingLocation(false);
      },
      (error) => {
        alert('Unable to get your location: ' + error.message);
        setLoadingLocation(false);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const config: TripConfig = {
      city: formData.city,
      arrivalDate: formData.arrivalDate,
      arrivalTime: formData.arrivalTime,
      returnDate: formData.returnDate,
      returnTime: formData.returnTime,
      accommodation: useCurrentLocation ? {
        lat: formData.accommodationLat,
        lng: formData.accommodationLng,
        address: formData.accommodationAddress,
      } : undefined,
      companions: formData.companions,
      transport: formData.transport,
      walkingPreference: formData.walkingPreference,
      bufferTime: formData.bufferTime,
      interests: [],
      budget: 'normal',
      restaurantPreferences: ['everything'],
    };

    setTripConfig(config);
    navigate('/setup2');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">InTown</h1>
          <p className="text-gray-600 dark:text-gray-300">Plan your perfect day, effortlessly</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <MapPin className="w-4 h-4" />
              City
            </label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              placeholder="e.g., Barcelona"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <Calendar className="w-4 h-4" />
                Arrival Date
              </label>
              <input
                type="date"
                required
                value={formData.arrivalDate}
                onChange={(e) => handleInputChange('arrivalDate', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <Clock className="w-4 h-4" />
                Arrival Time
              </label>
              <input
                type="time"
                required
                value={formData.arrivalTime}
                onChange={(e) => handleInputChange('arrivalTime', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <Calendar className="w-4 h-4" />
                Return Date
              </label>
              <input
                type="date"
                required
                value={formData.returnDate}
                onChange={(e) => handleInputChange('returnDate', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <Clock className="w-4 h-4" />
                Return Time
              </label>
              <input
                type="time"
                required
                value={formData.returnTime}
                onChange={(e) => handleInputChange('returnTime', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <MapPin className="w-4 h-4" />
              Accommodation
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={loadingLocation}
                className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loadingLocation ? 'Getting location...' : 'Use My Current Location'}
              </button>
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">or</div>
              <input
                type="text"
                value={formData.accommodationAddress}
                onChange={(e) => {
                  handleInputChange('accommodationAddress', e.target.value);
                  setUseCurrentLocation(false);
                }}
                placeholder="Enter accommodation address"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default TripSetup;
