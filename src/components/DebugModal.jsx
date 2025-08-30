import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DebugModal = ({ isOpen, onClose, zapHistory }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
      case 'confirmed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      case 'demo':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'confirmed':
        return '✅';
      case 'pending':
        return '⏳';
      case 'failed':
        return '❌';
      case 'demo':
        return '🎭';
      default:
        return '❓';
    }
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
          className="bg-black/20 backdrop-blur-md rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden border border-white/10 shadow-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Debug - Zap History</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold transition-colors"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh]">
            {zapHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-lg">No zap history yet</div>
                <div className="text-gray-500 text-sm mt-2">Zap someone to see history here</div>
              </div>
            ) : (
              <div className="space-y-3">
                {zapHistory.map((log) => (
                  <motion.div
                    key={log.id}
                    className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg">{getStatusIcon(log.status)}</span>
                          <span className={`font-mono text-sm ${getStatusColor(log.status)}`}>
                            {log.timestamp}
                          </span>
                          <span className={`text-sm font-medium ${getStatusColor(log.status)}`}>
                            {log.status.toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="text-white font-medium mb-1">
                          {log.recipient}
                        </div>
                        
                        <div className="text-gray-400 text-sm mb-2">
                          Amount: {Math.round(log.amount / 1000)} {Math.round(log.amount / 1000) === 1 ? 'sat' : 'sats'}
                          {log.debugInfo?.lightningAddress && (
                            <span className="ml-2 text-blue-400">
                              • {log.debugInfo.lightningAddress}
                            </span>
                          )}
                        </div>
                        

                        
                        {log.error && (
                          <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
                            <div className="text-red-300 text-sm font-mono break-words mb-2">
                              {log.error}
                            </div>
                            {log.debugInfo && (
                              <div className="border-t border-red-500/30 pt-2">
                                <div className="text-red-300 text-xs font-mono space-y-1">
                                  {Object.entries(log.debugInfo).map(([key, value]) => (
                                    <div key={key} className="flex">
                                      <span className="text-red-400 mr-2">{key}:</span>
                                      <span className="break-all">{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {!log.error && log.debugInfo?.hasPreimage !== undefined && (
                          <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                            <div className="text-green-300 text-xs font-mono">
                              <span className="text-green-400 mr-2">hasPreimage:</span>
                              <span>{log.debugInfo.hasPreimage ? 'true' : 'false'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-gray-400 text-sm text-center">
              Total logs: {zapHistory.length} (showing last 50)
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DebugModal;
