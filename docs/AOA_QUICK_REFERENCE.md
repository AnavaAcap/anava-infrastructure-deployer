# AOA Scenario JSON - Quick Reference

## Minimal Working Example

```json
{
  "id": 1,
  "name": "Basic Detection",
  "type": "motion",
  "enabled": true,
  "triggers": [{
    "type": "includeArea",
    "vertices": [[-0.9,-0.9], [-0.9,0.9], [0.9,0.9], [0.9,-0.9]]
  }],
  "objectClassifications": [{
    "type": "human"
  }]
}
```

## Key Concepts

### 1. Scenario Types
- **`motion`** - Detect movement in area
- **`occupancy`** - Count objects in area  
- **`fence`** - Detect crossing a line
- **`crosslinecount`** - Count crossings with direction

### 2. Coordinate System
```
  (-1, -1) -------- (1, -1)
     |                |
     |    CAMERA      |
     |     VIEW       |
     |                |
  (-1, 1) --------- (1, 1)
```

### 3. Time in Area (Critical!)
To make "loitering" work, you need **BOTH**:

```json
{
  "filters": [{
    "type": "timeShort",
    "data": 5000  // ← Milliseconds in filter
  }],
  "triggers": [{
    "conditions": [{
      "type": "individualTimeInArea",
      "data": [{
        "time": 5  // ← Seconds in condition
      }]
    }]
  }]
}
```

## Common Patterns

### Pattern 1: "Someone loitering for X seconds"
```json
{
  "type": "motion",
  "filters": [{"type": "timeShort", "data": X * 1000}],
  "triggers": [{
    "conditions": [{
      "type": "individualTimeInArea",
      "data": [{"type": "human", "time": X}]
    }]
  }],
  "objectClassifications": [{"type": "human"}]
}
```

### Pattern 2: "X or more people"
```json
{
  "type": "occupancy",
  "metadata": {"occupancyThreshold": X},
  "objectClassifications": [{"type": "human"}]
}
```

### Pattern 3: "Cars parking"
```json
{
  "type": "motion",
  "filters": [
    {"type": "timeShort", "data": 10000},
    {"type": "sizePercentage", "data": {"min": [20,20]}}
  ],
  "objectClassifications": [{"type": "vehicle", "subTypes": ["car"]}]
}
```

### Pattern 4: "People running" (fast movement)
```json
{
  "type": "motion",
  "filters": [{"type": "shortLived", "data": 2000}],
  "objectClassifications": [{"type": "human"}]
}
```

## Natural Language → JSON Mapping

| User Says | Type | Key Settings |
|-----------|------|--------------|
| "loitering" | motion | timeInArea: 10-30s |
| "3+ people" | occupancy | threshold: 3 |
| "parking" | motion | vehicle + timeInArea |
| "running" | motion | shortLived: 1-2s |
| "crossing" | fence | 2-point line |
| "counting" | crosslinecount | with direction |

## API Call Structure

```javascript
// What gets sent to camera
POST /local/objectanalytics/control.cgi
{
  "apiVersion": "1.0",
  "method": "addConfiguration",
  "params": {
    "scenarios": [/* Your scenario JSON */]
  }
}
```

## Filters Cheat Sheet

| Filter | Purpose | Value |
|--------|---------|-------|
| `timeShort` | Loitering time | Milliseconds |
| `sizePercentage` | Object size | {min:[w,h], max:[w,h]} |
| `shortLived` | Ignore quick objects | Milliseconds |
| `swayingObject` | Ignore trees/flags | Pixels |

## Object Types

```json
// Humans only
[{"type": "human"}]

// All vehicles
[{"type": "vehicle"}]

// Specific vehicles
[{"type": "vehicle", "subTypes": ["car", "truck"]}]

// Both
[{"type": "human"}, {"type": "vehicle"}]
```

## Areas & Lines

```json
// Full camera view
[[-0.9,-0.9], [-0.9,0.9], [0.9,0.9], [0.9,-0.9]]

// Center area
[[-0.5,-0.5], [-0.5,0.5], [0.5,0.5], [0.5,-0.5]]

// Horizontal line (for fence/crossline)
[[-0.9, 0], [0.9, 0]]

// Door area (bottom half)
[[-0.5,0.3], [-0.5,0.9], [0.5,0.9], [0.5,0.3]]
```

## Debugging Tips

1. **Not triggering?**
   - Check `enabled: true`
   - Verify area covers target zone
   - Ensure AOA is licensed

2. **Time in Area not working?**
   - Need BOTH filter (ms) AND condition (s)
   - Values should match (5000ms = 5s)

3. **Too sensitive?**
   - Add size filter
   - Increase time thresholds
   - Reduce area size

4. **Test coordinates:**
   - Start with full area `[[-0.9,-0.9]...]`
   - Gradually reduce to target zone