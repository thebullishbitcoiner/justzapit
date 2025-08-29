import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SettingsModal = ({ isOpen, onClose, settings, onSettingsChange }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-black/20 backdrop-blur-md rounded-lg p-6 max-w-md w-full mx-4 border border-white/10 shadow-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold transition-colors"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Default Zap Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Default Zap Amount (sats)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={Math.round(localSettings.defaultZapAmount / 1000)}
                onChange={(e) => {
                  const satsValue = parseInt(e.target.value) || 0;
                  const msatsValue = satsValue * 1000;
                  setLocalSettings(prev => ({
                    ...prev,
                    defaultZapAmount: msatsValue
                  }));
                }}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder="1"
              />
            </div>

            {/* Default Zap Message */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Default Zap Message
              </label>
              <input
                type="text"
                value={localSettings.defaultZapMessage}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  defaultZapMessage: e.target.value
                }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder="Just Zap It! ⚡"
                maxLength="200"
              />
              <p className="text-xs text-gray-400 mt-1">
                {localSettings.defaultZapMessage.length}/200 characters
              </p>
            </div>

            {/* Zap Friends of Friends Toggle */}
            <div>
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0 pr-4">
                  <label className="block text-sm font-medium text-gray-300">
                    Zap Friends of Friends <span className="text-yellow-400 text-sm">(SOON™)</span>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">
                    When enabled, the pool of zap recipients will include npubs your follows are following
                  </p>
                </div>
                <div className="flex-shrink-0 pt-1">
                  <button
                    disabled
                    className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-700 cursor-not-allowed opacity-50"
                  >
                    <span className="inline-block h-6 w-6 transform rounded-full bg-gray-400 translate-x-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end mt-8 pt-4 border-t border-white/10">
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-300 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsModal;
