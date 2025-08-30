import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

const FollowsModal = ({ isOpen, onClose, follows, isLoadingFollows }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const formatNpub = (npub) => {
    if (!npub) return '';
    if (npub.length <= 22) return npub;
    return `${npub.substring(0, 11)}...${npub.substring(npub.length - 11)}`;
  };

  const getDisplayName = (follow) => {
    if (follow.displayName && follow.displayName !== 'Unknown') {
      return follow.displayName;
    }
    if (follow.name && follow.name !== 'Unknown') {
      return follow.name;
    }
    return formatNpub(follow.npub);
  };

  // Filter follows based on search term
  const filteredFollows = useMemo(() => {
    if (!searchTerm.trim()) return follows;
    
    const term = searchTerm.toLowerCase();
    return follows.filter(follow => {
      const displayName = getDisplayName(follow).toLowerCase();
      const npub = (follow.npub || '').toLowerCase();
      const name = (follow.name || '').toLowerCase();
      const about = (follow.about || '').toLowerCase();
      
      return displayName.includes(term) || 
             npub.includes(term) || 
             name.includes(term) || 
             about.includes(term);
    });
  }, [follows, searchTerm]);

  const handleFollowClick = async (follow) => {
    if (!follow.npub) {
      console.log('No npub available for this follow');
      return;
    }

    try {
      await navigator.clipboard.writeText(follow.npub);
      console.log('✅ npub copied to clipboard:', follow.npub);
      
      // Show success toast
      toast.success('npub copied to clipboard!', {
        duration: 2000,
        style: {
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '14px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      });
    } catch (error) {
      console.error('❌ Failed to copy npub to clipboard:', error);
      
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = follow.npub;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('✅ npub copied using fallback method');
        
        // Show success toast for fallback method too
        toast.success('npub copied to clipboard!', {
          duration: 2000,
          style: {
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        });
      } catch (fallbackError) {
        console.error('❌ Fallback copy also failed:', fallbackError);
        
        // Show error toast
        toast.error('Failed to copy npub', {
          duration: 2000,
          style: {
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        });
      }
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
          className="bg-black/20 backdrop-blur-md rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden border border-white/10 shadow-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Your Follows</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold transition-colors"
            >
              ×
            </button>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search follows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400/50 transition-all"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh]">
            {isLoadingFollows ? (
              <div className="text-center py-8">
                <div className="text-yellow-400 text-lg">Loading follows...</div>
              </div>
            ) : filteredFollows.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-lg">
                  {searchTerm.trim() ? `No follows found matching "${searchTerm}"` : 'No follows found'}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFollows.map((follow, index) => {
                  const displayName = getDisplayName(follow);
                  if (!displayName) return null; // Skip if no display name
                  
                  return (
                    <motion.div
                      key={follow.pubkey && follow.pubkey !== 'unknown' ? follow.pubkey : `unknown-${index}`}
                      className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-sm rounded-lg hover:bg-white/10 transition-all cursor-pointer group border border-white/5"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleFollowClick(follow)}
                      title="Click to copy npub to clipboard"
                    >
                      {/* Name and details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate group-hover:text-yellow-400 transition-colors">
                          {displayName}
                        </div>
                        {follow.npub && (
                          <div className="text-gray-400 text-xs font-mono truncate group-hover:text-blue-400 transition-colors">
                            {formatNpub(follow.npub)}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-gray-400 text-sm text-center">
              {searchTerm.trim() ? (
                <>
                  Showing {filteredFollows.length} of {follows.length} follows
                </>
              ) : (
                <>
                  Total: {follows.length} follows
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FollowsModal;
