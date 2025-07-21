import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton, Dialog, DialogContent } from '@mui/material';
import { VolumeUp, VolumeOff, Close } from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';

// Retro CRT scanline effect
const scanlines = keyframes`
  0% { transform: translateY(0); }
  100% { transform: translateY(100%); }
`;

const RetroDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: '#000',
    border: '4px solid #00ff00',
    borderRadius: 0,
    boxShadow: '0 0 40px #00ff00, inset 0 0 20px rgba(0, 255, 0, 0.2)',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '200%',
      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 0, 0.1) 2px, rgba(0, 255, 0, 0.1) 4px)',
      animation: `${scanlines} 8s linear infinite`,
      pointerEvents: 'none',
    },
  },
}));

const RetroScreen = styled(Box)({
  background: '#000',
  color: '#00ff00',
  fontFamily: '"Courier New", monospace',
  padding: '40px',
  minHeight: '400px',
  position: 'relative',
  textShadow: '0 0 5px #00ff00',
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%)',
    pointerEvents: 'none',
  },
});

const blinkCursor = keyframes`
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

const Cursor = styled('span')({
  animation: `${blinkCursor} 1s infinite`,
});

const pixelBounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

const PixelText = styled(Typography)({
  fontFamily: '"Press Start 2P", "Courier New", monospace',
  fontSize: '24px',
  color: '#00ff00',
  textAlign: 'center',
  margin: '20px 0',
  animation: `${pixelBounce} 0.5s ease-in-out infinite`,
  textShadow: '2px 2px 0 #008800',
});

// 8-bit style musical notes using Web Audio API
const create8BitSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const playNote = (frequency: number, duration: number, startTime: number) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'square'; // 8-bit sound wave
    oscillator.frequency.setValueAtTime(frequency, startTime);
    
    gainNode.gain.setValueAtTime(0.1, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  // Play a retro deployment tune (similar to old installer music)
  const playDeploymentTune = () => {
    const now = audioContext.currentTime;
    const tempo = 0.15; // Duration of each note
    
    // Melody inspired by classic 8-bit games
    const notes = [
      523.25, 587.33, 659.25, 523.25, // C, D, E, C
      659.25, 698.46, 783.99, 0,      // E, F, G, rest
      783.99, 880.00, 783.99, 698.46, // G, A, G, F
      659.25, 523.25, 587.33, 523.25, // E, C, D, C
      440.00, 493.88, 523.25, 0,      // A4, B4, C5, rest
      523.25, 523.25, 523.25, 523.25, // Victory sound
    ];
    
    notes.forEach((freq, index) => {
      if (freq > 0) {
        playNote(freq, tempo * 0.9, now + index * tempo);
      }
    });
  };

  return { playDeploymentTune, audioContext };
};

interface RetroEasterEggProps {
  trigger?: 'konami' | 'click';
  onTrigger?: () => void;
}

const RetroEasterEgg: React.FC<RetroEasterEggProps> = ({ trigger = 'konami', onTrigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [typedText, setTypedText] = useState('');
  const audioRef = useRef<{ playDeploymentTune: () => void; audioContext: AudioContext } | null>(null);
  
  const fullText = `INITIALIZING ANAVA DEPLOYMENT SYSTEM...
  
> CHECKING QUANTUM ENTANGLEMENT... OK
> CALIBRATING FLUX CAPACITOR... OK  
> LOADING TURBO ENCABULATOR... OK
> SYNCING BLOCKCHAIN TO CLOUD... JK
> ENGAGING DEPLOYMENT HYPERDRIVE... 

SYSTEM READY! 

REMEMBER: WITH GREAT DEPLOYMENT POWER
COMES GREAT RESPONSIBILITY!

MAY THE CLOUD BE WITH YOU...`;

  useEffect(() => {
    // Initialize audio
    audioRef.current = create8BitSound();
    
    // Konami code detector
    if (trigger === 'konami') {
      const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
      let konamiIndex = 0;
      
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === konamiCode[konamiIndex]) {
          konamiIndex++;
          if (konamiIndex === konamiCode.length) {
            setIsOpen(true);
            onTrigger?.();
            konamiIndex = 0;
          }
        } else {
          konamiIndex = 0;
        }
      };
      
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [trigger, onTrigger]);

  useEffect(() => {
    if (isOpen && !isMuted) {
      // Play the tune when dialog opens
      setTimeout(() => {
        audioRef.current?.playDeploymentTune();
      }, 500);
      
      // Typewriter effect
      let index = 0;
      const typeInterval = setInterval(() => {
        if (index < fullText.length) {
          setTypedText(fullText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(typeInterval);
        }
      }, 30);
      
      return () => clearInterval(typeInterval);
    }
  }, [isOpen, isMuted, fullText]);

  const handleClose = () => {
    setIsOpen(false);
    setTypedText('');
  };

  return (
    <>
      {trigger === 'click' && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 10,
            left: 10,
            width: 10,
            height: 10,
            cursor: 'pointer',
            opacity: 0,
            '&:hover': { opacity: 0.1, backgroundColor: '#00ff00' },
          }}
          onClick={() => {
            setIsOpen(true);
            onTrigger?.();
          }}
        />
      )}
      
      <RetroDialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          <RetroScreen>
            <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }}>
              <IconButton
                onClick={() => setIsMuted(!isMuted)}
                sx={{ color: '#00ff00', mr: 1 }}
              >
                {isMuted ? <VolumeOff /> : <VolumeUp />}
              </IconButton>
              <IconButton
                onClick={handleClose}
                sx={{ color: '#00ff00' }}
              >
                <Close />
              </IconButton>
            </Box>
            
            <PixelText>
              -=- ANAVA DEPLOYER v1.337 -=-
            </PixelText>
            
            <Typography
              component="pre"
              sx={{
                fontFamily: 'inherit',
                fontSize: '14px',
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                mb: 2,
              }}
            >
              {typedText}
              <Cursor>█</Cursor>
            </Typography>
            
            {typedText === fullText && (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography sx={{ fontSize: '12px', opacity: 0.7 }}>
                  Press ESC to exit retro mode
                </Typography>
              </Box>
            )}
          </RetroScreen>
        </DialogContent>
      </RetroDialog>
    </>
  );
};

export default RetroEasterEgg;