import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import LightningEffect from "./LightningEffect";
import FollowsModal from "./FollowsModal";
import SettingsModal from "./SettingsModal";
import DebugModal from "./DebugModal";
import { useNostr } from "../hooks/useNostr";
import { showToast } from "../App";
import { init, launchModal, requestProvider, onConnected, onDisconnected } from "@getalby/bitcoin-connect-react";
import { AnimatePresence } from "framer-motion";
import packageJson from "../../package.json";

/**
 * LightningApp Component
 * 
 * This component implements zapping using @getalby/lightning-tools:
 * 
 * Lightning-tools provides a simpler and more direct approach to zapping:
 * 1. Create LightningAddress instance with the recipient's lightning address
 * 2. Fetch LNURL data to get zap capabilities
 * 3. Use the zap() method to send zaps with Nostr integration
 * 4. Automatic handling of NIP-57 zap requests and LUD-06/16 protocols
 * 5. Built-in support for comments, relays, and event targeting
 */

export default function LightningApp() {
  const [lightningCount, setLightningCount] = useState(0);
  const [activeEffects, setActiveEffects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [bitcoinProvider, setBitcoinProvider] = useState(null);
  const [settings, setSettings] = useState({
    defaultZapAmount: 1000, // msats
    defaultZapMessage: "JustZapIt! ⚡",
    zapFriendsOfFriends: false
  });
  const [zapHistory, setZapHistory] = useState([]);
  const [pendingZaps, setPendingZaps] = useState(new Map()); // Track pending zaps waiting for receipts
  const { follows, getRandomFollow, isLoadingFollows, disconnect, ndk, isNdkReady } = useNostr();
  
  // Debug NDK state
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] NDK state in LightningApp:`, { 
      hasNdk: !!ndk, 
      connected: ndk?.connected,
      relays: ndk?.relays?.size,
      relayUrls: ndk?.relays ? Array.from(ndk.relays.values()).map(r => r.url) : []
    });
  }, [ndk]);
  const effectCounter = useRef(0);
  const containerRef = useRef(null);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('justzapit_settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  // Initialize Bitcoin Connect
  useEffect(() => {
    // Initialize bitcoin-connect
    init({
      appName: 'JustZapIt',
    });

    // Set up event listeners
    onConnected((provider) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Bitcoin Connect: Wallet connected!`);
      console.log(`[${timestamp}] Connected provider details:`, {
        providerType: provider?.constructor?.name,
        availableMethods: Object.keys(provider || {}),
        hasSendPayment: !!(provider && provider.sendPayment)
      });
      
      setIsWalletConnected(true);
      console.log(`[${timestamp}] Wallet state updated: isWalletConnected = true`);
      
      // Setup NDK wallet for zapping
      setupNdkWallet(provider);
    });

    onDisconnected(() => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Bitcoin Connect: Wallet disconnected`);
      console.log(`[${timestamp}] Wallet disconnected`);
      // Clean up NDK wallet
      setBitcoinProvider(null);
      console.log(`[${timestamp}] Zapper cleaned up`);
    });

    return () => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Cleaning up Bitcoin Connect event listeners`);
    };
  }, [ndk]);

  const setupNdkWallet = async (provider) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Setting up wallet for Lightning-tools zapping...`);
    console.log(`[${timestamp}] Provider details:`, {
      hasProvider: !!provider,
      providerType: provider?.constructor?.name,
      availableMethods: Object.keys(provider || {})
    });

    try {
      if (!ndk) {
        console.log(`[${timestamp}] NDK not available for wallet setup`);
        return;
      }

      console.log(`[${timestamp}] NDK available, storing Bitcoin Connect provider`);
      setBitcoinProvider(provider);

      // Lightning-tools uses Bitcoin Connect provider directly for payments
      // No additional wallet configuration needed
      console.log(`[${timestamp}] Bitcoin Connect provider ready for Lightning-tools zapping`);

    } catch (error) {
      console.error(`[${timestamp}] Failed to setup wallet for zapping:`, error);
      console.error(`[${timestamp}] Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      showToast("Failed to setup wallet for zapping");
    }
  };

  // Lightning-tools zap implementation
  const createLightningZapper = async (lightningAddress, amountMsats = 1000) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Creating Lightning-tools zapper...`);
    console.log(`[${timestamp}] Lightning Address:`, lightningAddress);
    console.log(`[${timestamp}] Amount (msats):`, amountMsats);

    try {
      // Import LightningAddress from lightning-tools
      const { LightningAddress } = await import('@getalby/lightning-tools/lnurl');
      
      if (!lightningAddress) {
        throw new Error('No lightning address provided');
      }

      console.log(`[${timestamp}] Using lightning address:`, lightningAddress);
      
      // Create LightningAddress instance
      const ln = new LightningAddress(lightningAddress);
      
      // Fetch LNURL data to get zap capabilities
      console.log(`[${timestamp}] Fetching LNURL data...`);
      await ln.fetch();
      
      console.log(`[${timestamp}] LNURL data fetched:`, {
        hasLnurlpData: !!ln.lnurlpData,
        hasKeysendData: !!ln.keysendData,
        callback: ln.lnurlpData?.callback
      });

      // Create target user object
      const targetUser = {
        displayName: lightningAddress.split('@')[0] // Use username part of lightning address
      };

      return {
        ln,
        targetUser,
        lightningAddress
      };
    } catch (error) {
      console.error(`[${timestamp}] Failed to create Lightning-tools zapper:`, error);
      throw error;
    }
  };







  const performLightningZap = async (lightningAddress, amountMsats = null) => {
    const zapAmount = amountMsats || settings.defaultZapAmount;
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Starting Lightning-tools zap process...`);
    console.log(`[${timestamp}] Target:`, lightningAddress);
    console.log(`[${timestamp}] Amount:`, zapAmount, 'msats');

    try {
      // Create Lightning-tools zapper
      const { ln, targetUser, lightningAddress: resolvedAddress } = await createLightningZapper(lightningAddress, zapAmount);
      
      // Log properties of the ln object
      console.log(`[${timestamp}] LightningAddress object properties:`, {
        lightningAddress: ln.lightningAddress,
        lnurlpData: ln.lnurlpData,
        keysendData: ln.keysendData,
        hasLnurlpData: !!ln.lnurlpData,
        hasKeysendData: !!ln.keysendData,
        lnurlpDataKeys: ln.lnurlpData ? Object.keys(ln.lnurlpData) : null,
        keysendDataKeys: ln.keysendData ? Object.keys(ln.keysendData) : null,
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(ln)).filter(name => name !== 'constructor'),
        allProperties: Object.keys(ln)
      });
      
      // Check if we have a Bitcoin Connect provider for payments
      if (!bitcoinProvider) {
        throw new Error('No Bitcoin Connect provider available for payments');
      }

      // Get relays from NDK for Nostr integration
      const relays = ndk?.relays ? Array.from(ndk.relays.values()).map(r => r.url) : ['wss://relay.damus.io'];
      console.log(`[${timestamp}] Using relays:`, relays);

      // Execute zap using lightning-tools with Bitcoin Connect
      console.log(`[${timestamp}] Executing zap with Lightning-tools and Bitcoin Connect...`);
      
      const zapArgs = {
        satoshi: Math.floor(zapAmount / 1000), // Convert msats to satoshis
        comment: settings.defaultZapMessage,
        relays: relays,
        // Optional: target a specific event (we're zapping the user, not an event)
        // e: "event_id_here"
      };

      // Generate zap invoice manually and pay with Bitcoin Connect
      const invoice = await ln.zapInvoice(zapArgs); // generates a zap invoice
      console.log(`[${timestamp}] Generated zap invoice:`, invoice.paymentRequest.substring(0, 20) + '...');
      
      // Pay the invoice with Bitcoin Connect
      if (!bitcoinProvider) {
        throw new Error('No Bitcoin Connect provider available for payments');
      }
      
      console.log(`[${timestamp}] Paying invoice via Bitcoin Connect...`);
      const paymentResult = await bitcoinProvider.sendPayment(invoice.paymentRequest);
      console.log(`[${timestamp}] Bitcoin Connect payment successful:`, {
        preimage: paymentResult.preimage ? paymentResult.preimage.substring(0, 20) + '...' : 'null'
      });
      
      // Payment is considered successful if Bitcoin Connect returns without error
      // No need to verify payment status as Bitcoin Connect handles this
      const response = {
        preimage: paymentResult.preimage
      };
      
      console.log(`[${timestamp}] Lightning-tools zap completed!`);
      console.log(`[${timestamp}] Response:`, {
        preimage: response.preimage ? response.preimage.substring(0, 20) + '...' : 'null',
        success: !!response.preimage
      });
      
      return {
        success: !!response.preimage,
        preimage: response.preimage,
        lightningAddress: resolvedAddress,
        targetUser
      };
      
    } catch (error) {
      console.error(`[${timestamp}] Lightning-tools zap failed:`, error);
      throw error;
    }
  };

  // Helper function to get display name for toast
  const getDisplayNameForToast = (follow) => {
    if (follow.displayName && follow.displayName !== 'Unknown') {
      return follow.displayName;
    }
    if (follow.name && follow.name !== 'Unknown') {
      return follow.name;
    }
    if (follow.npub) {
      // Shorten npub for display
      if (follow.npub.length <= 22) return follow.npub;
      return `${follow.npub.substring(0, 11)}...${follow.npub.substring(follow.npub.length - 11)}`;
    }
    return 'Unknown User';
  };

    const handleLightningClick = () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Lightning icon clicked!`);
          console.log(`[${timestamp}] Current state:`, {
      isWalletConnected,
      hasBitcoinProvider: !!bitcoinProvider,
      followsCount: follows.length,
      ndkAvailable: !!ndk
    });

    // Create new lightning effect
    const effectId = effectCounter.current++;
    setActiveEffects(prev => [...prev, effectId]);
    
    // Remove effect after animation
    setTimeout(() => {
      setActiveEffects(prev => prev.filter(id => id !== effectId));
    }, 2000);

    setLightningCount(prev => prev + 1);

    // Use a random follow from the cached follows list
    if (follows.length === 0) {
      console.log(`[${timestamp}] No follows available for zapping`);
      showToast("No follows available for zapping");
      return;
    }
    
    // Pick a random follow that has a LUD-16
    const followsWithLud16 = follows.filter(follow => follow.lud16);
    console.log(`[${timestamp}] Follows with LUD-16: ${followsWithLud16.length}/${follows.length}`);
    
    if (followsWithLud16.length === 0) {
      console.log(`[${timestamp}] No follows with LUD-16 available for zapping`);
      showToast("No follows with LUD-16 available for zapping");
      return;
    }
    
    const randomFollow = followsWithLud16[Math.floor(Math.random() * followsWithLud16.length)];
    const lightningAddress = randomFollow.lud16 || randomFollow.lud06;
    const displayName = randomFollow.displayName || randomFollow.name || 'Unknown User';
    
    console.log(`[${timestamp}] Selected random follow for zapping:`, {
      npub: randomFollow.npub,
      displayName: displayName,
      lightningAddress: lightningAddress
    });

    // Check if Bitcoin Connect wallet is connected and ready for Lightning-tools zapping
    if (isWalletConnected && bitcoinProvider) {
      console.log(`[${timestamp}] Bitcoin Connect wallet ready for Lightning-tools zapping...`);
      console.log(`[${timestamp}] Target:`, displayName);
      
      // Show immediate toast that zap is starting
      showToast(`You just zapped ${displayName}! ⚡`);
      
      // Perform Lightning-tools zap in the background using settings
      performLightningZap(lightningAddress)
        .then((result) => {
          console.log(`[${timestamp}] Lightning-tools zap completed:`, result);
          
          // Consider zap successful if the process completed, regardless of preimage
          addZapLog(displayName, settings.defaultZapAmount, 'success', null, {
            message: 'Lightning-tools zap completed successfully',
            preimage: result.preimage,
            lightningAddress: result.lightningAddress,
            hasPreimage: !!result.preimage
          });
        })
        .catch((error) => {
          console.error(`[${timestamp}] Lightning-tools zap failed:`, error);
          addZapLog(displayName, settings.defaultZapAmount, 'failed', error.message);
        });
    } else {
      console.log(`[${timestamp}] Demo mode - no Bitcoin Connect wallet connected`);
      console.log(`[${timestamp}] Wallet status:`, { 
        isWalletConnected, 
        hasBitcoinProvider: !!bitcoinProvider 
      });
      
      // Show demo toast immediately
      showToast(`Demo mode: Would zap ${displayName}! ⚡`);
      addZapLog(displayName, settings.defaultZapAmount, 'demo', 'Demo mode - no Bitcoin Connect wallet connected');
    }
  };

  const handleLogout = () => {
    disconnect();
    window.location.reload();
  };

  const addZapLog = (recipient, amount, status, error = null, debugInfo = null) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: true, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    const log = {
      id: Date.now(),
      timestamp,
      recipient,
      amount,
      status, // 'success' or 'failed'
      error,
      debugInfo
    };
    
    setZapHistory(prev => [log, ...prev.slice(0, 49)]); // Keep last 50 logs
  };



  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    // Save to localStorage
    localStorage.setItem('justzapit_settings', JSON.stringify(newSettings));
    showToast("Settings saved!");
  };

  const handleWalletClick = () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Wallet label clicked...`);
    console.log(`[${timestamp}] Current wallet state:`, {
      isWalletConnected,
      hasBitcoinProvider: !!bitcoinProvider
    });
    
    try {
      console.log(`[${timestamp}] Calling requestProvider() to open Bitcoin Connect modal...`);
      launchModal();
    } catch (error) {
      console.error('❌ Error requesting provider:', error);
      console.error('🔍 Provider request error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      showToast("Failed to open wallet connection");
    }
  };

  return (
    <div className="lightning-container" ref={containerRef}>
      {/* Multiple lightning effects can run simultaneously */}
      {activeEffects.map(effectKey => (
        <LightningEffect key={effectKey} effectKey={effectKey} />
      ))}

      {/* Header with action menu */}
      <div className="absolute top-6 right-6 z-20">
        <motion.button
          className="font-mono text-2xl text-gray-500/80 hover:text-gray-400 cursor-pointer transition-colors"
          onClick={() => setIsActionMenuOpen(prev => !prev)}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.1 }}
        >
          ☰
        </motion.button>
        
        {/* Action Menu */}
        <AnimatePresence>
          {isActionMenuOpen && (
            <motion.div
              className="absolute top-8 right-0 bg-black/20 backdrop-blur-md rounded-lg p-2 min-w-[120px] border border-white/10 shadow-2xl"
              initial={{ opacity: 0, scale: 0.8, y: -5, x: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -5, x: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <motion.button
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded flex items-center gap-2 transition-all"
                onClick={() => {
                  setIsSettingsModalOpen(true);
                  setIsActionMenuOpen(false);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </motion.button>
              <motion.button
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded flex items-center gap-2 transition-all"
                onClick={() => {
                  setIsDebugModalOpen(true);
                  setIsActionMenuOpen(false);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Debug
              </motion.button>
              <motion.button
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded flex items-center gap-2 transition-all"
                onClick={handleLogout}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Follows and wallet info - terminal style */}
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-1">
        <motion.div
          className="font-mono text-xs text-gray-500/80"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          JustZapIt v{packageJson.version}
        </motion.div>
        <motion.div
          className="font-mono text-xs text-gray-500/80 cursor-pointer hover:text-gray-400 transition-colors"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          onClick={() => setIsModalOpen(true)}
        >
          {isLoadingFollows ? (
            <span className="text-yellow-400/80">loading...</span>
          ) : (
            <span>Follows: {follows.length}</span>
          )}
        </motion.div>
        
        <motion.div
          className="font-mono text-xs text-gray-500/80 cursor-pointer hover:text-gray-400 transition-colors"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
          onClick={handleWalletClick}
        >
          Wallet: {window.webln ? "WebLN" : isWalletConnected ? "Bitcoin Connect" : "None"}
        </motion.div>
      </div>

      {/* Main lightning icon */}
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          className="text-[12rem] md:text-[20rem] cursor-pointer lightning-glow"
          onClick={handleLightningClick}
          initial={{ scale: 0, opacity: 0, y: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            y: [0, -10, 0],
            filter: [
              "drop-shadow(0 0 20px #ffd700) drop-shadow(0 0 40px #ffed4e)",
              "drop-shadow(0 0 30px #ffd700) drop-shadow(0 0 60px #ffed4e)",
              "drop-shadow(0 0 20px #ffd700) drop-shadow(0 0 40px #ffed4e)"
            ]
          }}
          transition={{ 
            type: "spring", 
            stiffness: 260, 
            damping: 20,
            delay: 0.3,
            y: {
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            },
            filter: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
          whileHover={{ 
            scale: 1.1,
            filter: "drop-shadow(0 0 40px #ffd700) drop-shadow(0 0 80px #ffed4e)"
          }}
          whileTap={{ 
            scale: 0.9,
            filter: "drop-shadow(0 0 60px #ffd700) drop-shadow(0 0 120px #ffed4e)"
          }}
        >
          ⚡
        </motion.div>
      </div>

      {/* Background electric specks */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`yellow-speck-${i}`}
            className="absolute w-1 h-1 bg-yellow-400/60 rounded-full"
            style={{
              left: `${20 + (i * 7) % 80}%`,
              top: `${15 + (i * 11) % 70}%`,
            }}
            animate={{
              opacity: [0.3, 0.8, 0.3],
              scale: [0.5, 1.5, 0.5],
              boxShadow: [
                "0 0 4px rgba(255, 255, 0, 0.3)",
                "0 0 12px rgba(255, 255, 0, 0.6)",
                "0 0 4px rgba(255, 255, 0, 0.3)"
              ]
            }}
            transition={{
              duration: 2 + (i * 0.3),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`blue-speck-${i}`}
            className="absolute w-0.5 h-0.5 bg-blue-400/40 rounded-full"
            style={{
              left: `${25 + (i * 9) % 75}%`,
              top: `${20 + (i * 13) % 65}%`,
            }}
            animate={{
              opacity: [0.2, 0.6, 0.2],
              scale: [0.3, 1.2, 0.3],
              boxShadow: [
                "0 0 2px rgba(59, 130, 246, 0.2)",
                "0 0 8px rgba(59, 130, 246, 0.4)",
                "0 0 2px rgba(59, 130, 246, 0.2)"
              ]
            }}
            transition={{
              duration: 1.5 + (i * 0.25),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.15,
            }}
          />
        ))}
      </div>

      {/* Follows Modal */}
      <FollowsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        follows={follows}
        isLoadingFollows={isLoadingFollows}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />

      {/* Debug Modal */}
      <DebugModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
        zapHistory={zapHistory}
      />
    </div>
  );
}
