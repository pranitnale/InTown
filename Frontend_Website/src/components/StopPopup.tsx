import React, { useState } from 'react';
import { X, ExternalLink, Clock, MapPin, Volume2, VolumeX, Quote } from 'lucide-react';
import { Stop } from '../types';

interface StopPopupProps {
  stop: Stop;
  onClose: () => void;
}

const StopPopup: React.FC<StopPopupProps> = ({ stop, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const handleGenerateNarration = () => {
    if ('speechSynthesis' in window && stop.narrationScript) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(stop.narrationScript);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    } else {
      alert('Text-to-speech is not supported in your browser');
    }
  };

  const totalTime = stop.dwellMinutes + stop.bufferMinutes;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full md:max-w-2xl bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {stop.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{stop.category}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {stop.preferenceFit}
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Timing</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Arrive at {stop.arrivalTime} • Stay {stop.dwellMinutes} min
                {stop.bufferMinutes > 0 && ` + ${stop.bufferMinutes} min buffer`}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total time: {totalTime} minutes
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Quote className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white mb-1">Significance</div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{stop.significance}</p>
            </div>
          </div>

          {stop.narrationScript && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900 dark:text-white">Audio Narration</div>
                <button
                  onClick={handleGenerateNarration}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isPlaying
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <VolumeX className="w-4 h-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      Play (60-90s)
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {showTranscript ? 'Hide' : 'Show'} transcript
              </button>
              {showTranscript && (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {stop.narrationScript}
                </p>
              )}
            </div>
          )}

          <div>
            <div className="font-medium text-gray-900 dark:text-white mb-2">Sources</div>
            <div className="space-y-2">
              {stop.citations.map((citation, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {citation.source}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      (Updated: {citation.timestamp})
                    </span>
                    {citation.url && (
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 ml-2"
                      >
                        View source
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {stop.officialLink && (
            <a
              href={stop.officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Official Website
            </a>
          )}

          <button
            onClick={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${stop.location.lat},${stop.location.lng}`;
              window.open(url, '_blank');
            }}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Navigate Here
          </button>
        </div>
      </div>
    </div>
  );
};

export default StopPopup;
