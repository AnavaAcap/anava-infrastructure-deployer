# AOA Natural Language Processing Guide

## Overview

The AOA NL Processor uses Google's Gemini AI to convert natural language descriptions into proper Axis Object Analytics (AOA) scenario configurations. This allows users to describe what they want to detect in plain English instead of understanding complex technical settings.

## How It Works

1. **User describes** what they want to detect (e.g., "Someone loitering near the ATM")
2. **Gemini AI analyzes** the description and maps it to AOA capabilities
3. **System generates** a complete AOA scenario configuration
4. **Configuration deploys** to the camera automatically

## Examples of Natural Language to AOA Mapping

### Loitering Detection
**Input**: "Someone hanging around the entrance for more than 30 seconds"
**Output**:
- Type: `motion`
- Objects: `humans: true`
- Filter: `timeInArea: 30` seconds
- Area: Entrance zone

### Vehicle Parking
**Input**: "Cars parking in the loading zone"
**Output**:
- Type: `motion`
- Objects: `vehicles: true`, subtypes: `['car']`
- Filter: `timeInArea: 10-20` seconds
- Area: Loading zone area

### Running Detection
**Input**: "People running through the hallway"
**Output**:
- Type: `motion`
- Objects: `humans: true`
- Filter: `shortLivedLimit: 1-2` seconds (quick movement)
- NO timeInArea (running is transient)

### Delivery Detection
**Input**: "Delivery trucks at the dock"
**Output**:
- Type: `motion` or `occupancy`
- Objects: `vehicles: true`, subtypes: `['truck']`
- Filter: `timeInArea: 30+` seconds
- Filter: `minimumSize: {width: 20, height: 20}` (trucks are large)

### Crowd Formation
**Input**: "Groups of people gathering"
**Output**:
- Type: `occupancy`
- Objects: `humans: true`
- Threshold: 5+ people
- Filter: `timeInArea: 10+` seconds

### Pet Walking
**Input**: "People walking their dogs"
**Output**:
- Type: `motion`
- Objects: `humans: true`
- NO timeInArea (walking is movement)
- Note: Dogs can't be directly detected, focuses on humans

## Understanding the AI's Logic

The AI considers several factors when converting descriptions:

### 1. Object Identification
- **Humans**: people, person, someone, customer, visitor, employee
- **Vehicles**: car, truck, bus, motorcycle, vehicle, delivery

### 2. Behavior Analysis
- **Stationary**: loitering, waiting, standing, parking → adds `timeInArea`
- **Movement**: walking, running, passing → no `timeInArea`
- **Crossing**: jumping, crossing, entering → may use `fence` or `crossline`

### 3. Time Interpretation
- Explicit times: "30 seconds" → `timeInArea: 30`
- Implicit waiting: "loitering" → `timeInArea: 10-30` (estimated)
- Quick actions: "running" → `shortLivedLimit: 1-2`

### 4. Context Understanding
- "ATM" → smaller focused area, higher security
- "Parking lot" → full area coverage, vehicle focus
- "Entrance" → crossline counting may be appropriate

## API Usage

### Basic Processing
```typescript
const processor = new AOANaturalLanguageProcessor(geminiApiKey);
const result = await processor.processNaturalLanguage({
  description: "Someone loitering by the entrance",
  cameraContext: "office building",
  strictness: 'medium'
});
```

### Direct Deployment
```typescript
const result = await deployNLScenario(
  cameraIp,
  username,
  password,
  geminiApiKey,
  "Cars parking illegally",
  "no parking zone"
);
```

### IPC from Renderer
```typescript
// In React component
const response = await window.electron.ipcRenderer.invoke(
  'aoa-process-natural-language',
  geminiApiKey,
  description,
  context
);
```

## Common Patterns

### Security Scenarios
- "Unauthorized access" → Human detection with area restrictions
- "Tailgating" → Multiple humans in quick succession
- "Abandoned objects" → Occupancy with long timeInArea

### Traffic Monitoring
- "Traffic flow" → Vehicle counting with crossline
- "Illegal parking" → Vehicle with timeInArea in restricted zone
- "Speeding" → Vehicle with very short time crossing area

### Retail Analytics
- "Customer queue" → Human occupancy with line formation
- "Window shopping" → Human with moderate timeInArea
- "Store entry" → Human crossline counting

## Best Practices

### 1. Be Specific
✅ "People loitering near the ATM for more than 30 seconds"
❌ "Suspicious activity"

### 2. Include Time When Relevant
✅ "Cars parking for more than 5 minutes"
❌ "Cars in the area"

### 3. Provide Context
✅ Description: "Delivery trucks", Context: "loading dock"
❌ Description: "Trucks"

### 4. Use Action Words
✅ "People running", "Cars parking", "Someone jumping"
❌ "People", "Cars", "Person"

## Limitations

1. **No Audio Detection**: AOA is visual only
2. **No Face Recognition**: Detects humans, not individuals
3. **No Object Recognition**: Can't detect specific items (bags, phones)
4. **Weather Dependent**: Heavy rain/snow may affect detection
5. **Lighting Required**: Needs adequate lighting for detection

## Troubleshooting

### Issue: Configuration doesn't match expectation
- Check if description is specific enough
- Add context about the environment
- Use explicit time values

### Issue: Low confidence score
- Simplify the description
- Use standard terminology (human, vehicle)
- Avoid complex compound behaviors

### Issue: Wrong scenario type generated
- Explicitly mention the action (crossing, counting, monitoring)
- For counting, use words like "count", "number of"
- For fence, use "crossing", "jumping over"

## Integration with UI

The `AOANaturalLanguageConfig` React component provides:
- Text input for descriptions
- Context field for environment
- Common scenario templates
- Real-time AI processing
- Visual configuration preview
- One-click deployment

## Future Enhancements

1. **Learning from Feedback**: Store successful mappings for improvement
2. **Multi-language Support**: Process descriptions in other languages
3. **Scene Understanding**: Use camera view to suggest scenarios
4. **Behavioral Patterns**: Detect complex multi-step behaviors
5. **Schedule Integration**: Time-based scenario activation