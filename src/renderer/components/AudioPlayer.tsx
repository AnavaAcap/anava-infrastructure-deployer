import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Paper,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Download as DownloadIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';

interface AudioPlayerProps {
  audioBase64: string;
  title?: string;
  onPlay?: () => void;
  onComplete?: () => void;
  autoPlay?: boolean;
  showDownload?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBase64,
  title,
  onPlay,
  onComplete,
  autoPlay = false,
  showDownload = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!audioBase64) {
      setError('No audio data provided');
      setLoading(false);
      return;
    }

    // Create audio element
    const audio = audioRef.current;
    if (!audio) return;

    // Set audio source
    try {
      // Handle different base64 formats
      const base64Data = audioBase64.startsWith('data:audio')
        ? audioBase64
        : `data:audio/mp3;base64,${audioBase64}`;
      
      audio.src = base64Data;
      
      // Audio event listeners
      const handleLoadedMetadata = () => {
        setDuration(audio.duration);
        setLoading(false);
        if (autoPlay) {
          handlePlay();
        }
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (onComplete) onComplete();
      };

      const handleError = () => {
        setError('Failed to load audio');
        setLoading(false);
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };
    } catch (err) {
      setError('Invalid audio data');
      setLoading(false);
    }
  }, [audioBase64, autoPlay, onComplete]);

  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        if (onPlay) onPlay();
        
        // Update progress
        progressIntervalRef.current = setInterval(() => {
          setCurrentTime(audio.currentTime);
        }, 100);
      }).catch((err) => {
        console.error('Playback failed:', err);
        setError('Playback failed');
      });
    }
  };

  const handleSeek = (_: Event, value: number | number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = value as number;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (_: Event, value: number | number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newVolume = value as number;
    audio.volume = newVolume;
    setVolume(newVolume);
    setMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (muted) {
      audio.volume = volume || 0.5;
      setMuted(false);
    } else {
      audio.volume = 0;
      setMuted(true);
    }
  };

  const handleReplay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = 0;
    setCurrentTime(0);
    handlePlay();
  };

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = audioBase64.startsWith('data:audio')
        ? audioBase64
        : `data:audio/mp3;base64,${audioBase64}`;
      link.download = title ? `${title}.mp3` : 'audio-response.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <Paper sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Paper sx={{ p: 2, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Loading audio...
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
      }}
    >
      <audio ref={audioRef} preload="metadata" />
      
      {title && (
        <Typography variant="subtitle2" gutterBottom>
          {title}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Play/Pause Button */}
        <IconButton
          onClick={handlePlay}
          color="primary"
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>

        {/* Progress Bar */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ minWidth: 35 }}>
            {formatTime(currentTime)}
          </Typography>
          
          <Slider
            value={currentTime}
            max={duration}
            onChange={handleSeek}
            sx={{
              flex: 1,
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12,
              },
            }}
          />
          
          <Typography variant="caption" sx={{ minWidth: 35 }}>
            {formatTime(duration)}
          </Typography>
        </Box>

        {/* Volume Control */}
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 120 }}>
          <IconButton onClick={handleMuteToggle} size="small">
            {muted || volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </IconButton>
          
          <Slider
            value={muted ? 0 : volume}
            max={1}
            step={0.1}
            onChange={handleVolumeChange}
            sx={{
              width: 80,
              ml: 1,
              '& .MuiSlider-thumb': {
                width: 10,
                height: 10,
              },
            }}
          />
        </Box>

        {/* Additional Controls */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Replay">
            <IconButton onClick={handleReplay} size="small">
              <ReplayIcon />
            </IconButton>
          </Tooltip>
          
          {showDownload && (
            <Tooltip title="Download">
              <IconButton onClick={handleDownload} size="small">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Visual Waveform Placeholder */}
      <Box
        sx={{
          mt: 2,
          height: 40,
          backgroundColor: 'action.hover',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.5,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Audio Waveform
        </Typography>
      </Box>
    </Paper>
  );
};

export default AudioPlayer;