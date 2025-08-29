import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import LightningEffect from "./LightningEffect";
import FollowsModal from "./FollowsModal";
import { useNostr } from "../hooks/useNostr";
import { showToast } from "../App";
import { init, launchModal, requestProvider, onConnected, onDisconnected } from "@getalby/bitcoin-connect-react";
import { AnimatePresence } from "framer-motion";
import packageJson from "../../package.json";

export default function LightningApp() {
  const [lightningCount, setLightningCount] = useState(0);
  const [activeEffects, setActiveEffects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [bitcoinProvider, setBitcoinProvider] = useState(null);
  const { follows, getRandomFollow, isLoadingFollows, disconnect, ndk } = useNostr();
  const effectCounter = useRef(0);
  const containerRef = useRef(null);

  // Initialize Bitcoin Connect
  useEffect(() => {
    // Initialize bitcoin-connect
    init({
      appName: 'Just Zap It',
    });

    // Set up event listeners
    onConnected((provider) => {
      console.log('🔗 Bitcoin Connect: Wallet connected!');
      console.log('📦 Connected provider details:', {
        providerType: provider?.constructor?.name,
        availableMethods: Object.keys(provider || {}),
        hasSendPayment: !!(provider && provider.sendPayment)
      });
      
      setIsWalletConnected(true);
      console.log('✅ Wallet state updated: isWalletConnected = true');
      
      // Setup NDK wallet for zapping
      setupNdkWallet(provider);
    });

    onDisconnected(() => {
      console.log('🔌 Bitcoin Connect: Wallet disconnected');
      console.log('❌ Wallet disconnected');
      // Clean up NDK wallet
      setBitcoinProvider(null);
      console.log('🧹 Zapper cleaned up');
    });

    return () => {
      console.log('🧹 Cleaning up Bitcoin Connect event listeners');
    };
  }, [ndk]);

  const setupNdkWallet = async (provider) => {
    console.log('🔧 Setting up wallet for NIP-57 zapping...');
    console.log('📦 Provider details:', {
      hasProvider: !!provider,
      providerType: provider?.constructor?.name,
      availableMethods: Object.keys(provider || {})
    });

    try {
      if (!ndk) {
        console.log('❌ NDK not available for wallet setup');
        return;
      }

      console.log('✅ NDK available, storing Bitcoin Connect provider');
      setBitcoinProvider(provider);

    } catch (error) {
      console.error('❌ Failed to setup wallet for zapping:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      showToast("Failed to setup wallet for zapping");
    }
  };

  // NIP-57 Zapping Implementation
  const createZapRequest = async (recipientNpub, amountMsats = 1000) => {
    console.log('📝 Creating NIP-57 zap request...');
    console.log('🎯 Recipient:', recipientNpub);
    console.log('💰 Amount (msats):', amountMsats);

    try {
      // Get user's signer for signing the zap request
      const signer = ndk.signer;
      if (!signer) {
        throw new Error('No signer available');
      }

      console.log('🔧 Signer object:', signer);
      console.log('🔍 Signer methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(signer)));

      // Get user's pubkey - try different methods
      const user = await signer.user();
      console.log('👤 User object:', user);
      console.log('🔍 User object keys:', Object.keys(user));
      console.log('🔍 User object prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(user)));
      
      let senderPubkey;
      if (typeof user.hexpubkey === 'function') {
        senderPubkey = user.hexpubkey();
      } else if (user.pubkey) {
        senderPubkey = user.pubkey;
      } else if (user.hexpubkey) {
        senderPubkey = user.hexpubkey;
      } else {
        // Try to get pubkey from signer directly
        console.log('🔄 Trying to get pubkey from signer directly...');
        senderPubkey = await signer.getPublicKey();
      }

      console.log('👤 Sender pubkey:', senderPubkey);

      // Create zap request event using NDKEvent (NDK v2 approach)
      const { NDKEvent } = await import('@nostr-dev-kit/ndk');
      
      const zapRequestEvent = new NDKEvent(ndk, {
        kind: 9734,
        content: "Just Zap It! ⚡",
        pubkey: senderPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["relays", "wss://relay.primal.net", "wss://relay.damus.io"],
          ["amount", amountMsats.toString()],
          ["p", recipientNpub],
        ]
      });

      console.log('📋 Zap request event created:', zapRequestEvent);

      // Sign the event using NDK's built-in signing
      await zapRequestEvent.sign();
      console.log('✍️ Zap request signed:', zapRequestEvent.id);

      return zapRequestEvent;
    } catch (error) {
      console.error('❌ Failed to create zap request:', error);
      throw error;
    }
  };

  const getLnurlPayEndpoint = async (recipientNpub) => {
    console.log('🔍 Getting LNURL pay endpoint for:', recipientNpub);
    
    try {
      // First, try to get LNURL from cached follow data
      console.log('🔍 Looking for cached follow data...');
      const cachedFollow = follows.find(follow => follow.npub === recipientNpub);
      
      if (cachedFollow) {
        console.log('✅ Found cached follow data:', cachedFollow);
        const cachedLnurl = cachedFollow.lud06 || cachedFollow.lud16;
        
        if (cachedLnurl) {
          console.log('🔗 Found LNURL in cached data:', cachedLnurl);
          return await processLnurl(cachedLnurl);
        } else {
          console.log('❌ No LNURL found in cached data');
        }
      } else {
        console.log('❌ No cached follow data found for npub:', recipientNpub);
      }

      // Fallback: Try to fetch profile from relays
      console.log('🔄 Fallback: Attempting to fetch profile from relays...');
      
      // Ensure NDK is connected
      console.log('🔗 Checking NDK connection...');
      if (!ndk) {
        throw new Error('NDK not available');
      }
      
      // Get recipient's profile using the same approach as follows
      console.log('📡 Creating NDK user object for recipient...');
      const recipientUser = ndk.getUser({ npub: recipientNpub });
      console.log('👤 Created NDK user object:', recipientUser);
      console.log('🔍 NDK user properties:', {
        hasNdk: !!recipientUser.ndk,
        hasProfile: !!recipientUser.profile,
        npub: recipientUser.npub,
        pubkey: recipientUser.pubkey
      });
      
      // Try to fetch profile
      console.log('📡 Attempting to fetch profile...');
      await recipientUser.fetchProfile();
      console.log('✅ Profile fetch completed');
      
      console.log('👤 Recipient profile object:', recipientUser.profile);
      console.log('🔍 Profile keys:', recipientUser.profile ? Object.keys(recipientUser.profile) : 'No profile');
      
      console.log('👤 Recipient profile details:', {
        displayName: recipientUser.profile?.displayName,
        name: recipientUser.profile?.name,
        lud06: recipientUser.profile?.lud06,
        lud16: recipientUser.profile?.lud16,
        hasProfile: !!recipientUser.profile,
        profileType: typeof recipientUser.profile
      });

      // Check for LNURL in profile
      const lnurl = recipientUser.profile?.lud06 || recipientUser.profile?.lud16;
      
      if (!lnurl) {
        console.log('❌ No LNURL found in profile, trying direct profile fetch...');
        
        // Try to get profile from a different approach
        try {
          // Get the hex pubkey properly
          let hexpubkey;
          if (typeof recipientUser.hexpubkey === 'function') {
            hexpubkey = recipientUser.hexpubkey();
          } else if (recipientUser.pubkey) {
            hexpubkey = recipientUser.pubkey;
          } else {
            // Convert npub to hex pubkey
            const { bech32 } = await import('@nostr-dev-kit/ndk');
            hexpubkey = bech32.decode(recipientNpub).data;
          }
          
          console.log('🔑 Using hexpubkey:', hexpubkey);
          
          const profileEvent = await ndk.fetchEvent({
            kinds: [0],
            authors: [hexpubkey]
          });
          
          if (profileEvent) {
            console.log('📋 Found profile event:', profileEvent);
            const profileContent = JSON.parse(profileEvent.content);
            console.log('📄 Profile content:', profileContent);
            
            const fallbackLnurl = profileContent.lud06 || profileContent.lud16;
            if (fallbackLnurl) {
              console.log('🔗 Found LNURL in fallback profile:', fallbackLnurl);
              return await processLnurl(fallbackLnurl);
            }
          }
        } catch (fallbackError) {
          console.log('❌ Direct profile fetch failed:', fallbackError);
        }
        
        throw new Error('No LNURL found in recipient profile or cached data');
      }

      console.log('🔗 Found LNURL:', lnurl);
      return await processLnurl(lnurl);
      
    } catch (error) {
      console.error('❌ Failed to get LNURL pay endpoint:', error);
      throw error;
    }
  };

  const processLnurl = async (lnurl) => {
    console.log('🔗 Processing LNURL:', lnurl);
    
    try {
      let lnurlUrl;
      
      // Check if it's a lightning address (lud16) - contains @ symbol
      if (lnurl.includes('@')) {
        console.log('⚡ Detected lightning address (lud16):', lnurl);
        // Convert lightning address to LNURL format
        const [username, domain] = lnurl.split('@');
        lnurlUrl = `https://${domain}/.well-known/lnurlp/${username}`;
        console.log('🔗 Converted to LNURL URL:', lnurlUrl);
      } else {
        // It's already a LNURL (lud06) - decode it
        console.log('🔗 Detected LNURL (lud06):', lnurl);
        const { bech32 } = await import('@nostr-dev-kit/ndk');
        try {
          const decoded = bech32.decode(lnurl);
          lnurlUrl = new TextDecoder().decode(decoded.data);
          console.log('🔗 Decoded LNURL URL:', lnurlUrl);
        } catch (decodeError) {
          console.error('❌ Failed to decode LNURL:', decodeError);
          throw new Error(`Invalid LNURL format: ${decodeError.message}`);
        }
      }
      
      console.log('📡 Fetching LNURL endpoint...');
      const lnurlResponse = await fetch(lnurlUrl);
      
      if (!lnurlResponse.ok) {
        console.error('❌ LNURL endpoint returned error status:', lnurlResponse.status);
        const errorText = await lnurlResponse.text();
        console.error('📄 Error response:', errorText);
        throw new Error(`LNURL endpoint returned ${lnurlResponse.status}: ${errorText}`);
      }
      
      const responseText = await lnurlResponse.text();
      console.log('📄 Raw LNURL response:', responseText);
      
      let lnurlData;
      try {
        lnurlData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse LNURL response as JSON:', parseError);
        console.error('📄 Response was:', responseText);
        throw new Error(`LNURL endpoint returned invalid JSON: ${parseError.message}`);
      }
      
      console.log('✅ LNURL data parsed:', lnurlData);
      
      // Validate required fields
      if (!lnurlData.callback) {
        throw new Error('LNURL response missing callback field');
      }
      
      if (lnurlData.allowsNostr !== true) {
        console.warn('⚠️ LNURL endpoint does not support Nostr zaps');
      }
      
      return lnurlData;
      
    } catch (error) {
      console.error('❌ Failed to process LNURL:', error);
      throw error;
    }
  };

  const sendZapRequest = async (zapRequestEvent, lnurlData) => {
    console.log('📤 Sending zap request to LNURL callback...');
    
    try {
      // Convert NDKEvent to plain object for JSON encoding
      const eventData = {
        id: zapRequestEvent.id,
        pubkey: zapRequestEvent.pubkey,
        created_at: zapRequestEvent.created_at,
        kind: zapRequestEvent.kind,
        tags: zapRequestEvent.tags,
        content: zapRequestEvent.content,
        sig: zapRequestEvent.sig
      };
      
      console.log('📋 Event data for callback:', eventData);
      
      // Encode the zap request event
      const encodedEvent = encodeURIComponent(JSON.stringify(eventData));
      
      // Build callback URL with parameters
      const callbackUrl = `${lnurlData.callback}?amount=${zapRequestEvent.tags.find(t => t[0] === 'amount')[1]}&nostr=${encodedEvent}`;
      
      console.log('🔗 Callback URL:', callbackUrl);

      // Send the request
      const response = await fetch(callbackUrl);
      const result = await response.json();

      console.log('📥 LNURL callback response:', result);

      if (!result.pr) {
        throw new Error('No payment request in response');
      }

      return result.pr; // Return the bolt11 invoice
    } catch (error) {
      console.error('❌ Failed to send zap request:', error);
      throw error;
    }
  };

  const payInvoice = async (invoice) => {
    console.log('💳 Paying invoice via Bitcoin Connect...');
    
    try {
      if (!bitcoinProvider || !bitcoinProvider.sendPayment) {
        throw new Error('Bitcoin Connect provider not available');
      }

      console.log('📤 Sending payment...');
      const result = await bitcoinProvider.sendPayment(invoice);
      
      console.log('✅ Payment successful:', {
        preimage: result.preimage ? result.preimage.substring(0, 20) + '...' : 'null'
      });

      return result;
    } catch (error) {
      console.error('❌ Payment failed:', error);
      throw error;
    }
  };

  const performNip57Zap = async (recipientNpub, amountMsats = 1000) => {
    console.log('⚡ Starting NIP-57 zap process...');
    console.log('🎯 Target:', recipientNpub);
    console.log('💰 Amount:', amountMsats, 'msats');

    try {
      // Step 1: Create zap request event
      const zapRequestEvent = await createZapRequest(recipientNpub, amountMsats);
      
      // Step 2: Get LNURL pay endpoint
      const lnurlData = await getLnurlPayEndpoint(recipientNpub);
      
      // Step 3: Send zap request to LNURL callback
      const invoice = await sendZapRequest(zapRequestEvent, lnurlData);
      
      // Step 4: Pay the invoice
      const paymentResult = await payInvoice(invoice);
      
      console.log('🎉 NIP-57 zap completed successfully!');
      return paymentResult;
      
    } catch (error) {
      console.error('💥 NIP-57 zap failed:', error);
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
    console.log('⚡ Lightning icon clicked!');
    console.log('🔍 Current state:', {
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

    // Get a random follow for zapping
    const randomFollow = getRandomFollow();
    if (!randomFollow) {
      console.log('❌ No follows available for zapping');
      showToast("No follows available to zap! ⚡");
      return;
    }

    const displayName = getDisplayNameForToast(randomFollow);
    console.log('🎯 Selected follow for zapping:', displayName);

    // Check if wallet is connected and ready for NIP-57 zapping
    if (isWalletConnected && bitcoinProvider) {
      console.log('💰 Wallet connected and ready for NIP-57 zapping...');
      console.log('🎯 Target:', displayName);
      
      // Show immediate toast that zap is starting
      showToast(`You just zapped ${displayName}! ⚡`);
      
      // Get the recipient's npub from the cached follow
      const recipientNpub = randomFollow.npub;
      if (!recipientNpub) {
        console.log('❌ No npub found for follow:', randomFollow);
        showToast(`Failed to zap ${displayName} - no npub found`);
        return;
      }
      
      console.log('✅ Got recipient npub:', recipientNpub);
      
      // Perform NIP-57 zap in the background (1000 msats = 1 sat)
      performNip57Zap(recipientNpub, 1000)
        .then((result) => {
          console.log('✅ NIP-57 zap successful:', result);
          showToast(`Successfully zapped ${displayName}! ⚡`);
        })
        .catch((error) => {
          console.error('❌ NIP-57 zap failed:', error);
          console.error('🔍 Zap error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          showToast(`Failed to zap ${displayName}: ${error.message}`);
        });
    } else {
      console.log('🎭 Demo mode - no wallet connected or provider not ready');
      console.log('📊 Wallet status:', { isWalletConnected, hasBitcoinProvider: !!bitcoinProvider });
      
      // Show demo toast immediately
      showToast(`Demo mode: Would zap ${displayName}! ⚡`);
    }
  };

  const handleLogout = () => {
    disconnect();
    window.location.reload();
  };

  const handleWalletClick = () => {
    console.log('👆 Wallet label clicked...');
    console.log('📊 Current wallet state:', {
      isWalletConnected,
      hasBitcoinProvider: !!bitcoinProvider
    });
    
    try {
      console.log('🔗 Calling requestProvider() to open Bitcoin Connect modal...');
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
          Wallet Connected: {isWalletConnected ? "YES" : "NO"}
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
    </div>
  );
}
