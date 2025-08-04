# Anava Vision - Component Specifications

## React Component Architecture

### 1. WelcomeScreen Component

```jsx
// Props
interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

// Component Structure
<WelcomeScreen>
  <BackgroundCanvas /> // Particle effects
  <LogoContainer>
    <AnimatedLogo />
    <Title>Anava Vision</Title>
    <Subtitle>Transform your cameras into intelligent eyes</Subtitle>
  </LogoContainer>
  <CTAButton onClick={onGetStarted}>
    Try AI on My Network
    <ArrowIcon />
  </CTAButton>
  <SignInLink onClick={onSignIn}>
    Already have an account? Sign in
  </SignInLink>
</WelcomeScreen>
```

### 2. DiscoveryScreen Component

```jsx
// Props
interface DiscoveryScreenProps {
  onCameraFound: (camera: Camera) => void;
  onError: (error: Error) => void;
}

// State Management
const [status, setStatus] = useState<
  'searching' | 'found' | 'connecting' | 'preparing'
>('searching');
const [progress, setProgress] = useState(0);

// Component Structure
<DiscoveryScreen>
  <RadarContainer>
    <RadarSVG>
      <RadarCircles />
      <RadarSweep rotation={sweepAngle} />
      <DetectedDots cameras={foundCameras} />
    </RadarSVG>
  </RadarContainer>
  <StatusMessage>{getStatusMessage(status)}</StatusMessage>
  <ProgressBar value={progress} />
</DiscoveryScreen>
```

### 3. NeuralAwakeningScreen Component

```jsx
// Props
interface NeuralAwakeningProps {
  cameraFeed: MediaStream;
  onComplete: () => void;
}

// Component Structure
<NeuralAwakeningScreen>
  <VideoContainer>
    <CameraFeed stream={cameraFeed} />
    <NeuralOverlay>
      <AnimatedNeuralNetwork />
    </NeuralOverlay>
  </VideoContainer>
  <StatusContainer>
    <StatusText>AI is learning to see...</StatusText>
    <AnimatedProgressBar />
  </StatusContainer>
</NeuralAwakeningScreen>
```

### 4. AIInsightScreen Component

```jsx
// Props
interface AIInsightScreenProps {
  cameraFeed: MediaStream;
  initialInsight: string;
  onUserInput: (input: string) => void;
  onComplete: () => void;
}

// Component Structure
<AIInsightScreen>
  <VideoContainer>
    <CameraFeed stream={cameraFeed} />
    <AIOverlay detections={detections} />
  </VideoContainer>
  <InsightCard>
    <TypewriterText text={initialInsight} />
  </InsightCard>
  <InputContainer>
    <Label>What would you like me to watch for?</Label>
    <TextInput 
      placeholder={placeholders[currentPlaceholder]}
      onSubmit={onUserInput}
    />
  </InputContainer>
  <ActionButtons>
    <SecondaryButton>Learn More</SecondaryButton>
    <PrimaryButton onClick={onComplete}>Complete Setup</PrimaryButton>
  </ActionButtons>
</AIInsightScreen>
```

---

## Animation Specifications

### 1. Logo Breathing Animation

```javascript
const logoAnimation = {
  scale: [1, 1.05, 1],
  opacity: [0.8, 1, 0.8],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut"
  }
};
```

### 2. Radar Sweep Animation

```javascript
const radarSweepAnimation = {
  rotate: [0, 360],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "linear"
  }
};

// Radar wave pulse
const radarWaveAnimation = {
  scale: [0, 2],
  opacity: [1, 0],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeOut"
  }
};
```

### 3. Neural Network Animation

```javascript
class NeuralNetworkAnimation {
  constructor(canvas) {
    this.nodes = this.generateNodes(50);
    this.connections = this.generateConnections();
  }

  animate() {
    // Update node positions with Perlin noise
    this.nodes.forEach(node => {
      node.x += noise(node.id, time) * 0.5;
      node.y += noise(node.id + 1000, time) * 0.5;
    });

    // Pulse connections based on "data flow"
    this.connections.forEach(conn => {
      conn.opacity = 0.3 + Math.sin(time + conn.offset) * 0.3;
      conn.strokeWidth = 1 + Math.sin(time + conn.offset) * 0.5;
    });
  }
}
```

### 4. Typewriter Effect

```javascript
const TypewriterText = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(prev => prev + text[index]);
        index++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, 30); // 30ms per character
    
    return () => clearInterval(interval);
  }, [text]);
  
  return <Text>{displayedText}<Cursor /></Text>;
};
```

---

## Styling System

### Base Styles

```javascript
const theme = {
  colors: {
    primary: '#0066FF',
    primaryDark: '#0052CC',
    secondary: '#00D4FF',
    background: '#0A0E27',
    backgroundLight: '#141B3C',
    text: '#FFFFFF',
    textSecondary: '#8892B0',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444'
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },
  
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '16px',
    full: '9999px'
  },
  
  transitions: {
    fast: '200ms ease',
    normal: '300ms ease',
    slow: '600ms ease'
  }
};
```

### Component Styles

```javascript
// Glassmorphic Card
const GlassCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${props => props.theme.borderRadius.lg};
  padding: ${props => props.theme.spacing.lg};
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
`;

// Shimmer Button
const ShimmerButton = styled.button`
  background: linear-gradient(
    90deg,
    ${props => props.theme.colors.primary} 0%,
    ${props => props.theme.colors.secondary} 50%,
    ${props => props.theme.colors.primary} 100%
  );
  background-size: 200% 100%;
  animation: shimmer 3s ease-in-out infinite;
  color: white;
  font-weight: 600;
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.xl};
  border-radius: ${props => props.theme.borderRadius.full};
  border: none;
  cursor: pointer;
  transition: transform ${props => props.theme.transitions.fast};
  
  &:hover {
    transform: scale(1.05);
  }
`;

// Progress Bar
const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: ${props => props.theme.borderRadius.full};
  overflow: hidden;
  
  .fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      ${props => props.theme.colors.primary},
      ${props => props.theme.colors.secondary}
    );
    transition: width ${props => props.theme.transitions.slow};
  }
`;
```

---

## State Management

### Application Flow State

```typescript
type AppState = 
  | { stage: 'welcome' }
  | { stage: 'discovery'; progress: number }
  | { stage: 'awakening'; camera: Camera; progress: number }
  | { stage: 'insight'; camera: Camera; insight: string }
  | { stage: 'interactive'; camera: Camera; history: Message[] }
  | { stage: 'complete'; config: Configuration }
  | { stage: 'error'; error: Error; previousStage: AppState };

// State Machine
const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'START_DISCOVERY':
      return { stage: 'discovery', progress: 0 };
      
    case 'CAMERA_FOUND':
      return { stage: 'awakening', camera: action.camera, progress: 0 };
      
    case 'AI_READY':
      return { 
        stage: 'insight', 
        camera: state.camera, 
        insight: action.insight 
      };
      
    case 'USER_INTERACTION':
      return {
        stage: 'interactive',
        camera: state.camera,
        history: [...state.history, action.message]
      };
      
    case 'COMPLETE_SETUP':
      return { stage: 'complete', config: action.config };
      
    case 'ERROR':
      return { stage: 'error', error: action.error, previousStage: state };
  }
};
```

---

## Performance Optimizations

### 1. Lazy Loading

```javascript
const NeuralNetworkCanvas = lazy(() => 
  import('./components/NeuralNetworkCanvas')
);

const ParticleBackground = lazy(() => 
  import('./components/ParticleBackground')
);
```

### 2. Animation Frame Management

```javascript
class AnimationManager {
  constructor() {
    this.animations = new Set();
    this.rafId = null;
  }
  
  add(animation) {
    this.animations.add(animation);
    if (!this.rafId) this.start();
  }
  
  remove(animation) {
    this.animations.delete(animation);
    if (this.animations.size === 0) this.stop();
  }
  
  start() {
    const animate = (timestamp) => {
      this.animations.forEach(anim => anim(timestamp));
      this.rafId = requestAnimationFrame(animate);
    };
    this.rafId = requestAnimationFrame(animate);
  }
  
  stop() {
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}
```

### 3. Reduced Motion Support

```javascript
const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addListener(handleChange);
    
    return () => mediaQuery.removeListener(handleChange);
  }, []);
  
  return prefersReducedMotion;
};

// Usage in components
const reduceMotion = useReducedMotion();
const animationDuration = reduceMotion ? 0 : 600;
```

---

## Error Handling UI

### Error Modal Component

```jsx
const ErrorModal = ({ error, onRetry, onBack }) => {
  const getErrorContent = () => {
    switch (error.code) {
      case 'CAMERA_NOT_FOUND':
        return {
          icon: '😔',
          title: "We couldn't find any cameras",
          tips: [
            'Connected to the same network',
            'Powered on and accessible',
            'Using default Anava credentials'
          ]
        };
      
      case 'AI_SERVICE_ERROR':
        return {
          icon: '⚡',
          title: 'The AI service is taking a moment',
          tips: [
            'Setting up for the first time',
            'During high demand periods'
          ]
        };
        
      default:
        return {
          icon: '🤔',
          title: 'Something unexpected happened',
          tips: ['Check your internet connection', 'Try again in a moment']
        };
    }
  };
  
  const content = getErrorContent();
  
  return (
    <Modal>
      <Icon>{content.icon}</Icon>
      <Title>{content.title}</Title>
      <TipsList>
        {content.tips.map(tip => (
          <Tip key={tip}>• {tip}</Tip>
        ))}
      </TipsList>
      <Actions>
        <SecondaryButton onClick={onBack}>Go Back</SecondaryButton>
        <PrimaryButton onClick={onRetry}>Try Again</PrimaryButton>
      </Actions>
    </Modal>
  );
};
```

---

## Accessibility Implementation

### 1. Screen Reader Announcements

```javascript
const useAnnouncement = () => {
  const [announcement, setAnnouncement] = useState('');
  
  return {
    announce: (message) => {
      setAnnouncement(message);
      // Clear after announcement is read
      setTimeout(() => setAnnouncement(''), 100);
    },
    element: (
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    )
  };
};
```

### 2. Keyboard Navigation

```javascript
const useKeyboardNavigation = (items, onSelect) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => 
            prev > 0 ? prev - 1 : items.length - 1
          );
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => 
            prev < items.length - 1 ? prev + 1 : 0
          );
          break;
          
        case 'Enter':
          e.preventDefault();
          onSelect(items[focusedIndex]);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, items, onSelect]);
  
  return { focusedIndex, setFocusedIndex };
};
```