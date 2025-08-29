import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const LightningEffect = ({ effectKey }) => {
  const [lightningBolts, setLightningBolts] = useState([])

  // Function to generate zigzag lightning path
  const generateLightningPath = (startX, startY, endX, endY) => {
    const segments = 6 + Math.floor(Math.random() * 6) // 6-11 segments for more variation
    const points = [{ x: startX, y: startY }]
    
    for (let i = 1; i <= segments; i++) {
      const progress = i / segments
      const baseX = startX + (endX - startX) * progress
      const baseY = startY + (endY - startY) * progress
      
      // Add random offset perpendicular to the main direction
      const dx = endX - startX
      const dy = endY - startY
      const length = Math.sqrt(dx * dx + dy * dy)
      
      if (length > 0) {
        const perpX = -dy / length
        const perpY = dx / length
        
        // Random offset that gets smaller towards the end, but more dramatic
        const maxOffset = 40 * (1 - progress * 0.3) // More dramatic zigzags
        const offset = (Math.random() - 0.5) * maxOffset
        
        points.push({
          x: baseX + perpX * offset,
          y: baseY + perpY * offset
        })
      }
    }
    
    points.push({ x: endX, y: endY })
    return points
  }

  useEffect(() => {
    // Get the center of the screen (where the lightning icon is)
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    
    // Random number of bolts (8-16)
    const boltCount = 8 + Math.floor(Math.random() * 9)
    
    // Generate lightning bolts with random origins around the center
    const bolts = []
    for (let i = 0; i < boltCount; i++) {
      // Random origin within a small radius of the center
      const originRadius = 20 + Math.random() * 30
      const originAngle = Math.random() * Math.PI * 2
      const originX = centerX + Math.cos(originAngle) * originRadius
      const originY = centerY + Math.sin(originAngle) * originRadius
      
      // Random direction with more variation
      const angle = Math.random() * Math.PI * 2
      
      // Random distance with more variation
      const distance = 150 + Math.random() * 400
      const endX = originX + Math.cos(angle) * distance
      const endY = originY + Math.sin(angle) * distance
      
      // Generate zigzag path
      const path = generateLightningPath(originX, originY, endX, endY)
      
      bolts.push({
        id: `${effectKey}-${i}`,
        path: path,
        width: 2 + Math.random() * 5, // More width variation
        duration: 0.2 + Math.random() * 0.3, // Faster, more varied timing
        delay: 0, // All bolts start at the same time
      })
    }
    setLightningBolts(bolts)

    // Auto-cleanup after animation completes
    const timer = setTimeout(() => {
      setLightningBolts([])
    }, 1000) // Shorter duration

    return () => clearTimeout(timer)
  }, [effectKey])

  return (
    <div className="lightning absolute inset-0 pointer-events-none">
      {lightningBolts.map((bolt) => (
        <motion.svg
          key={bolt.id}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            duration: bolt.duration,
            delay: bolt.delay,
            ease: "easeOut"
          }}
        >
          <motion.path
            d={`M ${bolt.path.map((point, index) => 
              `${point.x} ${point.y}`
            ).join(' L ')}`}
            stroke="url(#lightningGradient)"
            strokeWidth={bolt.width}
            fill="none"
            strokeLinecap="round"
            filter="blur(1px)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: 1, 
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: bolt.duration * 0.6, // Faster path drawing
              delay: bolt.delay,
              ease: "easeOut"
            }}
          />
          <defs>
            <linearGradient id="lightningGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffd700" />
              <stop offset="50%" stopColor="#ffed4e" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
        </motion.svg>
      ))}

      {/* Screen flash effect */}
      <motion.div
        key={`flash-${effectKey}`}
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 0.1, delay: 0.05 }} // Faster flash
      />

      {/* Lightning particles shooting out */}
      {[...Array(40)].map((_, i) => { // More particles
        const angle = Math.random() * Math.PI * 2
        const distance = 30 + Math.random() * 300
        
        return (
          <motion.div
            key={`particle-${effectKey}-${i}`}
            className="absolute w-1 h-1 bg-yellow-400 rounded-full"
            style={{
              left: '50%',
              top: '50%',
            }}
            initial={{ 
              opacity: 0, 
              scale: 0,
              x: 0,
              y: 0
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
            }}
            transition={{
              duration: 0.4, // Faster particles
              delay: 0.05 + Math.random() * 0.1, // All start around the same time
              ease: "easeOut"
            }}
          />
        )
      })}

    </div>
  )
}

export default LightningEffect
