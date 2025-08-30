import { useState, useEffect, useRef } from 'react'
import NDK, { NDKNip07Signer } from '@nostr-dev-kit/ndk'

export function useNostr() {
  const [isConnected, setIsConnected] = useState(false)
  const [pubkey, setPubkey] = useState(null)
  const [follows, setFollows] = useState([])
  const [isLoadingFollows, setIsLoadingFollows] = useState(false)
  
  // Use ref to store NDK instance so it's immediately available
  const ndkRef = useRef(null)

  // Initialize NDK as singleton immediately
  useEffect(() => {
    const initializeNDK = async () => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Initializing NDK singleton...`)
      
      // Check if NIP-07 extension is available first
      if (!window.nostr) {
        console.log(`[${timestamp}] NIP-07 extension not detected - NDK will be initialized when user connects`)
        return
      }
      
      try {
        const nip07signer = new NDKNip07Signer()
        const ndkInstance = new NDK({ 
          signer: nip07signer,
          explicitRelayUrls: [
            'wss://relay.nostr.band'
          ],
          enableOutboxModel: false,
          enableNip46: false,
          autoConnectUserRelays: false
        })
        
        // Store singleton instance
        ndkRef.current = ndkInstance
        console.log(`[${timestamp}] NDK singleton initialized`)
        
        // Connect immediately as recommended in docs
        console.log(`[${timestamp}] Connecting NDK singleton...`)
        await ndkInstance.connect()
        console.log(`[${timestamp}] NDK singleton connected successfully`)
        
        // Log all connected relays
        if (ndkInstance.relays) {
          console.log(`[${timestamp}] NDK connected relays:`, Array.from(ndkInstance.relays.values()).map(r => r.url))
        }
      } catch (error) {
        console.error(`[${timestamp}] NDK singleton initialization error:`, error)
      }
    }
    
    initializeNDK()
  }, [])

  const connect = async () => {
    console.log('🔌 Connect function called')
    
    // Ensure NDK singleton is available
    if (!ndkRef.current) {
      console.error('❌ NDK singleton not available')
      alert('NDK not initialized. Please refresh the page.')
      return
    }

    try {
      console.log('📡 NDK should already be connected, verifying...')
      if (!ndkRef.current.connected) {
        console.log('⚠️ NDK not connected, connecting now...')
        await ndkRef.current.connect()
        console.log('✅ NDK connected')
        // Check relays with safety
        if (ndkRef.current.relays) {
          console.log('🔗 Connected relays:', ndkRef.current.relays.size)
          console.log('🔗 Relay URLs:', Array.from(ndkRef.current.relays.values()).map(r => r.url))
        } else {
          console.log('⚠️ Relays not yet available after connection')
        }
      } else {
        console.log('✅ NDK already connected')
        // Check relays with safety
        if (ndkRef.current.relays) {
          console.log('🔗 Connected relays:', ndkRef.current.relays.size)
          console.log('🔗 Relay URLs:', Array.from(ndkRef.current.relays.values()).map(r => r.url))
        } else {
          console.log('⚠️ Relays not available in connected state')
        }
      }
      
      console.log('📡 Getting user from signer...')
      const signer = ndkRef.current.signer
      const user = await signer.user()
      
      if (user && user.npub) {
        console.log('✅ User retrieved from signer:', user.npub)
        console.log('🔍 User details:', {
          npub: user.npub,
          pubkey: user.pubkey,
          hexpubkey: user.hexpubkey
        })
        console.log('🔍 Full user object:', user)
        
        // Try different ways to get the pubkey
        let userPubkey = user.hexpubkey
        if (!userPubkey && user.pubkey) {
          userPubkey = user.pubkey
        }
        if (!userPubkey && user.npub) {
          // Convert npub to hex if needed
          userPubkey = user.npub
        }
        console.log('🔍 Validating public key...')
        console.log('🔍 userPubkey value:', userPubkey)
        console.log('🔍 userPubkey type:', typeof userPubkey)
        console.log('🔍 userPubkey length:', userPubkey?.length)
        
        if (!userPubkey || userPubkey.length === 0) {
          console.error('❌ Invalid pubkey from signer user')
          console.error('❌ userPubkey value:', userPubkey)
          return
        }
        
        if (userPubkey.length !== 64) {
          console.error('❌ Invalid pubkey length:', userPubkey.length)
          return
        }
        
        console.log('✅ Public key validation passed')
        console.log('Received pubkey:', userPubkey.substring(0, 10) + '...')
        
        console.log('💾 Setting state and localStorage...')
        setPubkey(userPubkey)
        setIsConnected(true)
        localStorage.setItem('justzapit_nostr_pubkey', userPubkey)
        console.log('✅ State and localStorage updated')
        
        console.log('📡 About to call fetchFollows...')
        await fetchFollows(userPubkey)
        console.log('✅ fetchFollows completed')
      } else {
        console.error('❌ Failed to get user from signer')
      }
    } catch (error) {
      console.error('❌ Error in connect:', error)
    }
  }

  const fetchFollows = async (userPubkey) => {
    console.log('🔍 fetchFollows called with:', { ndk: !!ndkRef.current, pubkey: userPubkey?.substring(0, 10) + '...', pubkeyLength: userPubkey?.length })
    
    if (!ndkRef.current || !userPubkey) {
      console.log('❌ NDK or pubkey not available:', { ndk: !!ndkRef.current, pubkey: !!userPubkey })
      return
    }

    setIsLoadingFollows(true)
    console.log('🔄 Starting follows fetch process...')
    
    // Check cache freshness first (24 hours)
    const cachedFollows = localStorage.getItem('justzapit_nostr_follows')
    if (cachedFollows && cachedFollows !== 'no') {
      try {
        const parsed = JSON.parse(cachedFollows)
        if (parsed.length > 0 && parsed[0].fetchedAt) {
          const cacheAge = Date.now() - parsed[0].fetchedAt
          const cacheAgeHours = cacheAge / (1000 * 60 * 60)
          
          if (cacheAgeHours < 24) {
            console.log(`✅ Using fresh cached follows (${cacheAgeHours.toFixed(1)} hours old)`)
            setFollows(parsed)
            setIsLoadingFollows(false)
            return
          } else {
            console.log(`🔄 Cache is stale (${cacheAgeHours.toFixed(1)} hours old), fetching fresh data`)
          }
        }
      } catch (parseError) {
        console.log('❌ Failed to parse cached follows, fetching fresh data')
      }
    }
    
    try {
      // Connect to NDK first
      await ndkRef.current.connect()
      console.log('✅ NDK connected')
      
      // Get the signer from NDK
      const signer = ndkRef.current.signer
      console.log('📡 Step 1: Getting user from signer...')
      
      // Get user from the signer (as per NDK documentation)
      const signerUser = await signer.user()
      console.log('✅ User from signer:', signerUser)
      console.log('🔍 User details:', {
        npub: signerUser.npub,
        pubkey: signerUser.pubkey,
        hexpubkey: signerUser.hexpubkey
      })
      
      // Create a proper NDK user object with the NDK instance attached
      const userPubkey = signerUser.hexpubkey
      const user = ndkRef.current.getUser({ npub: signerUser.npub })
      console.log('✅ Created NDK user object:', user)
      console.log('🔍 NDK user details:', {
        npub: user.npub,
        pubkey: user.pubkey,
        hexpubkey: user.hexpubkey
      })
      
      console.log('📡 Step 2: Fetching user profile...')
      await user.fetchProfile()
      console.log('✅ User profile fetched:', user.profile)
      
      console.log('📡 Step 3: Getting user follows...')
      const follows = await user.follows()
      console.log('✅ Follows retrieved:', follows)
      
      if (follows && follows.size > 0) {
        console.log('📡 Step 4: Fetching follow profiles...')
        const followProfiles = []
        
        // Convert Set to Array and fetch profiles
        const followArray = Array.from(follows)
        console.log(`🔄 Fetching ${followArray.length} follow profiles...`)
        
        // Fetch profiles for each follow
        const profilePromises = followArray.map(async (followUser, index) => {
          try {
            // Safely get npub with error handling
            let npub = null
            try {
              npub = followUser.npub
            } catch (npubError) {
              console.log(`⚠️ Error accessing npub for follow ${index + 1}:`, npubError.message)
            }
            
            console.log(`📡 Fetching profile ${index + 1}/${followArray.length} for:`, npub?.substring(0, 10) + '...')
            
            // Check if the follow user has a valid npub
            if (!npub || npub.length === 0) {
              console.log(`⚠️ Skipping follow ${index + 1} - no valid npub`)
              return {
                pubkey: 'unknown',
                npub: null,
                displayName: null,
                name: null,
                picture: null,
                banner: null,
                website: null,
                about: null,
                nip05: null,
                lud06: null,
                lud16: null,
                location: null,
                email: null,
                github: null,
                twitter: null,
                fetchedAt: Date.now()
              }
            }
            
            // Safely fetch profile
            try {
              await followUser.fetchProfile()
            } catch (fetchError) {
              console.log(`⚠️ Failed to fetch profile for follow ${index + 1}:`, fetchError.message)
            }
            
            // Safely access properties
            let pubkey = 'unknown'
            let profile = null
            
            try {
              pubkey = followUser.hexpubkey ? followUser.hexpubkey : 'unknown'
            } catch (pubkeyError) {
              console.log(`⚠️ Error accessing hexpubkey for follow ${index + 1}:`, pubkeyError.message)
            }
            
            try {
              profile = followUser.profile
            } catch (profileError) {
              console.log(`⚠️ Error accessing profile for follow ${index + 1}:`, profileError.message)
            }
            
            return {
              pubkey: pubkey,
              npub: npub || null,
              displayName: profile?.displayName || profile?.name || null,
              name: profile?.name || null,
              picture: profile?.picture || null,
              banner: profile?.banner || null,
              website: profile?.website || null,
              about: profile?.about || null,
              nip05: profile?.nip05 || null,
              lud06: profile?.lud06 || null,
              lud16: profile?.lud16 || null,
              // Additional metadata fields
              location: profile?.location || null,
              email: profile?.email || null,
              github: profile?.github || null,
              twitter: profile?.twitter || null,
              // Timestamp for cache freshness
              fetchedAt: Date.now()
            }
          } catch (error) {
            console.log(`⚠️ Failed to fetch profile for follow ${index + 1}:`, error.message)
            
            // Safely access properties even in error case
            let pubkey = 'unknown'
            try {
              pubkey = followUser.hexpubkey ? followUser.hexpubkey : 'unknown'
            } catch (pubkeyError) {
              console.log(`⚠️ Error accessing hexpubkey in error handler for follow ${index + 1}:`, pubkeyError.message)
            }
            
            return {
              pubkey: pubkey,
              npub: npub || null,
              displayName: null,
              name: null,
              picture: null,
              banner: null,
              website: null,
              about: null,
              nip05: null,
              lud06: null,
              lud16: null,
              location: null,
              email: null,
              github: null,
              twitter: null,
              fetchedAt: Date.now()
            }
          }
        })
        
        const profiles = await Promise.all(profilePromises)
        followProfiles.push(...profiles)
        
        console.log('✅ Follow profiles fetched:', followProfiles.length)
        setFollows(followProfiles)
        
        // Cache follows
        localStorage.setItem('justzapit_nostr_follows', JSON.stringify(followProfiles))
        console.log('💾 Follows cached in localStorage')
      } else {
        console.log('📭 No follows found')
        setFollows([])
        localStorage.setItem('justzapit_nostr_follows', 'no')
      }
    } catch (error) {
      console.error('💥 Error in fetchFollows:', error)
      console.log('Error details:', { message: error.message, stack: error.stack, name: error.name })
      
      // Try to use cached follows as fallback
      console.log('🔄 Attempting fallback to cached follows...')
      const cachedFollows = localStorage.getItem('justzapit_nostr_follows')
      if (cachedFollows && cachedFollows !== 'no') {
        try {
          const parsed = JSON.parse(cachedFollows)
          setFollows(parsed)
          console.log('✅ Using cached follows:', parsed.length)
        } catch (parseError) {
          console.log('❌ Failed to parse cached follows:', parseError)
          setFollows([])
        }
      } else {
        console.log('⚠️ No cached follows found')
        setFollows([])
      }
    } finally {
      setIsLoadingFollows(false)
      console.log('🏁 fetchFollows completed')
    }
  }

  const getRandomFollow = () => {
    if (follows.length === 0) return null
    const randomIndex = Math.floor(Math.random() * follows.length)
    return follows[randomIndex]
  }

  const disconnect = () => {
    setIsConnected(false)
    setPubkey(null)
    setFollows([])
    localStorage.removeItem('justzapit_nostr_pubkey')
    localStorage.removeItem('justzapit_nostr_follows')
  }

  useEffect(() => {
    console.log('🔄 useNostr useEffect - checking for saved session...')
    // Check if user was previously connected
    const savedPubkey = localStorage.getItem('justzapit_nostr_pubkey')
    const savedFollows = localStorage.getItem('justzapit_nostr_follows')
    
    console.log('💾 Saved data found:', {
      pubkey: savedPubkey ? `${savedPubkey.substring(0, 10)}...` : 'none',
      pubkeyLength: savedPubkey ? savedPubkey.length : 0,
      follows: savedFollows ? 'yes' : 'no'
    })
    
    if (savedPubkey && savedPubkey.length > 0) {
      console.log('🔄 Restoring saved session...')
      setPubkey(savedPubkey)
      setIsConnected(true)
      
      if (savedFollows) {
        try {
          const parsed = JSON.parse(savedFollows)
          console.log('✅ Restored follows from cache:', parsed.length)
          setFollows(parsed)
        } catch (error) {
          console.error('❌ Error parsing saved follows:', error)
        }
      }
      
      // Try to fetch fresh follows in the background
      console.log('🔄 Attempting to fetch fresh follows...')
      setTimeout(() => {
        fetchFollows(savedPubkey)
      }, 1000)
    } else {
      console.log('📝 No saved session found')
    }
  }, [])

  // Check if NDK singleton is ready
  const isNdkReady = () => {
    return ndkRef.current && 
           ndkRef.current.connected && 
           ndkRef.current.relays && 
           ndkRef.current.relays.size > 0;
  };

  return {
    isConnected,
    pubkey,
    ndk: ndkRef.current, // Expose the singleton NDK instance
    isNdkReady, // Expose the ready check function
    follows,
    isLoadingFollows,
    connect,
    disconnect,
    getRandomFollow,
    fetchFollows
  }
}