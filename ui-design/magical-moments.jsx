// Anava Vision - Magical Moments Implementation Examples

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

// ===============================================
// 1. PARTICLE BACKGROUND FOR WELCOME SCREEN
// ===============================================

const ParticleBackground = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current, 
      alpha: true,
      antialias: true 
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.z = 50;
    
    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 500;
    const posArray = new Float32Array(particlesCount * 3);
    
    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 100;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.005,
      color: '#00D4FF',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
    
    // Animation
    const animate = () => {
      requestAnimationFrame(animate);
      
      particlesMesh.rotation.y += 0.0003;
      particlesMesh.rotation.x += 0.0001;
      
      // Make particles float
      const positions = particlesMesh.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.01;
      }
      particlesMesh.geometry.attributes.position.needsUpdate = true;
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);
  
  return <canvas ref={canvasRef} className="particle-background" />;
};

// ===============================================
// 2. RADAR DISCOVERY ANIMATION
// ===============================================

const RadarDiscovery = ({ onCameraFound }) => {
  const [detectedCameras, setDetectedCameras] = useState([]);
  const [sweepAngle, setSweepAngle] = useState(0);
  
  useEffect(() => {
    const sweepInterval = setInterval(() => {
      setSweepAngle(prev => (prev + 2) % 360);
    }, 20);
    
    // Simulate camera discovery
    const discoveryTimeout = setTimeout(() => {
      const mockCamera = {
        id: 'cam-001',
        ip: '192.168.1.100',
        angle: 45,
        distance: 0.7
      };
      setDetectedCameras([mockCamera]);
      setTimeout(() => onCameraFound(mockCamera), 1000);
    }, 3000);
    
    return () => {
      clearInterval(sweepInterval);
      clearTimeout(discoveryTimeout);
    };
  }, [onCameraFound]);
  
  return (
    <div className="radar-container">
      <svg width="300" height="300" viewBox="0 0 300 300">
        {/* Radar circles */}
        {[1, 2, 3].map(i => (
          <motion.circle
            key={i}
            cx="150"
            cy="150"
            r={i * 40}
            fill="none"
            stroke="rgba(0, 212, 255, 0.2)"
            strokeWidth="1"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.2, duration: 0.5 }}
          />
        ))}
        
        {/* Radar sweep */}
        <motion.line
          x1="150"
          y1="150"
          x2="150"
          y2="30"
          stroke="url(#sweepGradient)"
          strokeWidth="2"
          style={{
            transformOrigin: '150px 150px',
            transform: `rotate(${sweepAngle}deg)`
          }}
        />
        
        {/* Sweep gradient */}
        <defs>
          <linearGradient id="sweepGradient">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="#00D4FF" />
          </linearGradient>
        </defs>
        
        {/* Detected cameras */}
        <AnimatePresence>
          {detectedCameras.map(camera => {
            const x = 150 + Math.cos(camera.angle * Math.PI / 180) * camera.distance * 120;
            const y = 150 + Math.sin(camera.angle * Math.PI / 180) * camera.distance * 120;
            
            return (
              <motion.g key={camera.id}>
                <motion.circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill="#00D4FF"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.5, 1] }}
                  transition={{ duration: 0.5 }}
                />
                <motion.circle
                  cx={x}
                  cy={y}
                  r="15"
                  fill="none"
                  stroke="#00D4FF"
                  strokeWidth="2"
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>
      
      <motion.div 
        className="radar-status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {detectedCameras.length === 0 
          ? "Searching for intelligent cameras..."
          : "Camera discovered! Establishing connection..."
        }
      </motion.div>
    </div>
  );
};

// ===============================================
// 3. NEURAL NETWORK AWAKENING OVERLAY
// ===============================================

const NeuralNetworkOverlay = ({ isActive }) => {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const connectionsRef = useRef([]);
  
  useEffect(() => {
    if (!canvasRef.current || !isActive) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Generate nodes
    const nodeCount = 30;
    for (let i = 0; i < nodeCount; i++) {
      nodesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 3 + 2,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }
    
    // Generate connections
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (Math.random() < 0.1) { // 10% chance of connection
          connectionsRef.current.push({
            from: i,
            to: j,
            strength: Math.random() * 0.5 + 0.5
          });
        }
      }
    }
    
    // Animation loop
    let animationId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw nodes
      nodesRef.current.forEach((node, index) => {
        // Update position
        node.x += node.vx;
        node.y += node.vy;
        
        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
        
        // Update pulse
        node.pulsePhase += 0.02;
        const pulseFactor = 1 + Math.sin(node.pulsePhase) * 0.3;
        
        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * pulseFactor, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${0.6 + Math.sin(node.pulsePhase) * 0.4})`;
        ctx.fill();
        
        // Glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * pulseFactor * 3);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      });
      
      // Draw connections
      connectionsRef.current.forEach(connection => {
        const from = nodesRef.current[connection.from];
        const to = nodesRef.current[connection.to];
        const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        const maxDistance = 150;
        
        if (distance < maxDistance) {
          const opacity = (1 - distance / maxDistance) * connection.strength * 0.3;
          
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Data flow animation
          const flowProgress = (Date.now() / 1000) % 1;
          const flowX = from.x + (to.x - from.x) * flowProgress;
          const flowY = from.y + (to.y - from.y) * flowProgress;
          
          ctx.beginPath();
          ctx.arc(flowX, flowY, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 212, 255, ${opacity * 2})`;
          ctx.fill();
        }
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="neural-overlay-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}
    />
  );
};

// ===============================================
// 4. TYPEWRITER EFFECT WITH CURSOR
// ===============================================

const TypewriterText = ({ text, onComplete, speed = 30 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);
  
  return (
    <div className="typewriter-container">
      <span className="typewriter-text">{displayedText}</span>
      {!isComplete && <span className="typewriter-cursor" />}
    </div>
  );
};

// ===============================================
// 5. CAMERA FEED WITH AI VISION OVERLAY
// ===============================================

const AIVisionOverlay = ({ detections = [], insights = [] }) => {
  return (
    <div className="ai-vision-overlay">
      {/* Detection boxes */}
      {detections.map((detection, index) => (
        <motion.div
          key={index}
          className="detection-box"
          style={{
            left: `${detection.x}%`,
            top: `${detection.y}%`,
            width: `${detection.width}%`,
            height: `${detection.height}%`
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
        >
          <div className="detection-label">{detection.label}</div>
          <div className="detection-confidence">{Math.round(detection.confidence * 100)}%</div>
        </motion.div>
      ))}
      
      {/* Insight points */}
      {insights.map((insight, index) => (
        <motion.div
          key={index}
          className="insight-point"
          style={{
            left: `${insight.x}%`,
            top: `${insight.y}%`
          }}
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.5, 1] }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <div className="insight-ripple" />
          <div className="insight-tooltip">{insight.text}</div>
        </motion.div>
      ))}
    </div>
  );
};

// ===============================================
// 6. MAGICAL LOADING STATES
// ===============================================

const MagicalLoader = ({ status }) => {
  const messages = {
    discovering: "Searching for intelligent cameras...",
    connecting: "Establishing secure connection...",
    awakening: "Awakening AI capabilities...",
    preparing: "Preparing neural pathways...",
    ready: "AI is ready to see your world!"
  };
  
  return (
    <motion.div className="magical-loader">
      <div className="loader-orb">
        <motion.div
          className="orb-core"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="orb-ring"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.8, 0.3, 0.8]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
      
      <motion.p
        key={status}
        className="loader-message"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {messages[status]}
      </motion.p>
    </motion.div>
  );
};

// ===============================================
// 7. SUCCESS CELEBRATION
// ===============================================

const SuccessCelebration = ({ onComplete }) => {
  useEffect(() => {
    // Create confetti or particle burst effect
    const particles = [];
    const colors = ['#0066FF', '#00D4FF', '#FFFFFF'];
    
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10 - 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 5 + 2,
        life: 1
      });
    }
    
    // Animation logic here...
    
    setTimeout(onComplete, 3000);
  }, [onComplete]);
  
  return (
    <motion.div 
      className="success-celebration"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="success-icon"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.5 }}
      >
        ✨
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        AI Vision Activated!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Your camera can now see with intelligence
      </motion.p>
    </motion.div>
  );
};

export {
  ParticleBackground,
  RadarDiscovery,
  NeuralNetworkOverlay,
  TypewriterText,
  AIVisionOverlay,
  MagicalLoader,
  SuccessCelebration
};