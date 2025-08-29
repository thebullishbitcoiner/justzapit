import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import LandingPage from "./components/LandingPage";
import LightningApp from "./components/LightningApp";
import { useNostr } from "./hooks/useNostr";

// Custom toast function that enforces a limit of 5 toasts
let toastCount = 0;
const maxToasts = 5;

const showToast = (message) => {
  if (toastCount >= maxToasts) {
    // Remove the oldest toast
    toast.dismiss();
  }
  
  toastCount++;
  const toastId = toast.success(message, {
    duration: 3000,
    onDismiss: () => {
      toastCount--;
    },
  });
  
  return toastId;
};

// Export the custom toast function
export { showToast };

function App() {
  const { isConnected, connect } = useNostr();
  const [showLightning, setShowLightning] = useState(false);

  const handleLogin = async () => {
    console.log('🎯 handleLogin called in App component')
    try {
      console.log('📞 About to call connect()...')
      await connect();
      console.log('✅ connect() completed successfully')
    } catch (error) {
      console.error('❌ Login failed:', error);
    }
  };

  useEffect(() => {
    console.log('🔄 App useEffect - isConnected changed:', isConnected)
    if (isConnected) {
      console.log('⚡ Setting showLightning to true')
      setShowLightning(true);
    }
  }, [isConnected]);

  console.log('🎨 App render - isConnected:', isConnected, 'showLightning:', showLightning)

  return (
    <div className="App">
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
        containerStyle={{
          bottom: 20,
        }}
      />
      <AnimatePresence mode="wait">
        {!showLightning ? (
          <LandingPage key="landing" onLogin={handleLogin} />
        ) : (
          <LightningApp key="lightning" />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App
