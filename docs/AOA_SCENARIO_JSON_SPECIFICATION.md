# AOA Scenario JSON Specification

## Overview
This document describes the JSON payload structure used to create Axis Object Analytics (AOA) scenarios programmatically via VAPIX APIs.

## Complete JSON Structure

```json
{
  "id": 1,
  "name": "Crowd at Door",
  "type": "occupancy",
  "enabled": true,
  "triggers": [
    {
      "type": "includeArea",
      "vertices": [
        [-0.5, 0.3],
        [-0.5, 0.9],
        [0.5, 0.9],
        [0.5, 0.3]
      ],
      "conditions": [
        {
          "type": "individualTimeInArea",
          "data": [
            {
              "type": "human",
              "time": 5,
              "alarmTime": 1
            }
          ]
        }
      ]
    }
  ],
  "filters": [
    {
      "type": "timeShort",
      "data": 5000
    },
    {
      "type": "sizePercentage",
      "data": {
        "min": [5, 5],
        "max": [100, 100]
      }
    }
  ],
  "objectClassifications": [
    {
      "type": "human"
    },
    {
      "type": "vehicle",
      "subTypes": ["car", "truck", "bus", "motorcycle/bicycle"]
    }
  ],
  "perspectives": [
    {
      "perspective": 0,
      "type": "corridor",
      "calibrated": false,
      "transform": [
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 1.0
      ]
    }
  ],
  "metadata": {
    "occupancyThreshold": 3,
    "crosslineDirection": "left-right"
  }
}
```

## Field Descriptions

### Root Level Fields

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | number | Yes | Unique identifier for the scenario (1-16) | `1` |
| `name` | string | Yes | Human-readable name (max 15 chars) | `"Entrance Monitor"` |
| `type` | string | Yes | Scenario type | `"motion"`, `"fence"`, `"crosslinecount"`, `"occupancy"` |
| `enabled` | boolean | Yes | Whether scenario is active | `true` |
| `triggers` | array | Yes | Array of trigger configurations | See Triggers section |
| `filters` | array | No | Array of filter configurations | See Filters section |
| `objectClassifications` | array | Yes | Objects to detect | See Objects section |
| `perspectives` | array | No | Camera perspective settings | See Perspectives section |
| `metadata` | object | No | Type-specific settings | See Metadata section |

### Scenario Types

#### 1. Motion Detection (`"type": "motion"`)
Detects objects moving within a defined area.

```json
{
  "type": "motion",
  "triggers": [{
    "type": "includeArea",
    "vertices": [[-0.9, -0.9], [-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]]
  }]
}
```

#### 2. Virtual Fence (`"type": "fence"`)
Detects objects crossing a virtual line.

```json
{
  "type": "fence",
  "triggers": [{
    "type": "fence",
    "vertices": [[-0.9, 0], [0.9, 0]]  // Just 2 points for a line
  }]
}
```

#### 3. Crossline Counting (`"type": "crosslinecount"`)
Counts objects crossing a line with direction.

```json
{
  "type": "crosslinecount",
  "triggers": [{
    "type": "crossline",
    "vertices": [[-0.5, 0], [0.5, 0]]
  }],
  "metadata": {
    "crosslineDirection": "left-right"  // or "right-left" or "both"
  }
}
```

#### 4. Occupancy (`"type": "occupancy"`)
Monitors how many objects are in an area.

```json
{
  "type": "occupancy",
  "triggers": [{
    "type": "includeArea",
    "vertices": [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5]]
  }],
  "metadata": {
    "occupancyThreshold": 3  // Trigger when 3+ objects
  }
}
```

### Triggers

Triggers define the detection zones and conditions.

#### Include Area Trigger
```json
{
  "type": "includeArea",
  "vertices": [
    [-0.5, 0.3],   // Top-left (x, y)
    [-0.5, 0.9],   // Bottom-left
    [0.5, 0.9],    // Bottom-right
    [0.5, 0.3]     // Top-right
  ],
  "conditions": []  // Optional conditions
}
```

**Coordinate System**:
- Normalized coordinates from -1.0 to 1.0
- Origin (0, 0) is center of camera view
- X-axis: -1 (left) to 1 (right)
- Y-axis: -1 (top) to 1 (bottom)

#### Conditions (for Time in Area)
```json
{
  "conditions": [{
    "type": "individualTimeInArea",
    "data": [{
      "type": "human",
      "time": 5,        // Seconds to wait
      "alarmTime": 1    // How often to trigger (seconds)
    }]
  }]
}
```

### Filters

Filters refine what triggers detection.

#### Time Filter (Loitering/Dwelling)
```json
{
  "type": "timeShort",
  "data": 5000  // Milliseconds (5000ms = 5 seconds)
}
```

#### Size Filter
```json
{
  "type": "sizePercentage",
  "data": {
    "min": [10, 10],   // Minimum width%, height%
    "max": [80, 80]    // Maximum width%, height%
  }
}
```

#### Swaying Object Filter
```json
{
  "type": "swayingObject",
  "data": 5  // Distance in pixels
}
```

#### Short-lived Object Filter
```json
{
  "type": "shortLived",
  "data": 2000  // Milliseconds (ignore if visible < 2s)
}
```

### Object Classifications

Define what objects to detect.

#### Humans Only
```json
"objectClassifications": [
  {
    "type": "human"
  }
]
```

#### Vehicles with Subtypes
```json
"objectClassifications": [
  {
    "type": "vehicle",
    "subTypes": ["car", "truck", "bus", "motorcycle/bicycle"]
  }
]
```

#### Both Humans and Vehicles
```json
"objectClassifications": [
  {
    "type": "human"
  },
  {
    "type": "vehicle",
    "subTypes": ["car", "truck"]
  }
]
```

### Perspectives

Camera angle configuration for better detection.

```json
"perspectives": [
  {
    "perspective": 0,      // Camera channel (usually 0)
    "type": "corridor",    // or "overhead", "side", "ground"
    "calibrated": false,
    "transform": [
      1.0, 0.0, 0.0,      // 3x3 transformation matrix
      0.0, 1.0, 0.0,
      0.0, 0.0, 1.0
    ]
  }
]
```

## Real-World Examples

### Example 1: Loitering Detection
**Use Case**: Alert when someone stands near ATM for >30 seconds

```json
{
  "id": 1,
  "name": "ATM Loitering",
  "type": "motion",
  "enabled": true,
  "triggers": [{
    "type": "includeArea",
    "vertices": [[-0.3, -0.3], [-0.3, 0.3], [0.3, 0.3], [0.3, -0.3]],
    "conditions": [{
      "type": "individualTimeInArea",
      "data": [{
        "type": "human",
        "time": 30,
        "alarmTime": 1
      }]
    }]
  }],
  "filters": [{
    "type": "timeShort",
    "data": 30000
  }],
  "objectClassifications": [{
    "type": "human"
  }]
}
```

### Example 2: Vehicle Parking Detection
**Use Case**: Detect cars parking in no-parking zone

```json
{
  "id": 2,
  "name": "No Parking",
  "type": "motion",
  "enabled": true,
  "triggers": [{
    "type": "includeArea",
    "vertices": [[-0.8, 0.2], [-0.8, 0.8], [-0.2, 0.8], [-0.2, 0.2]]
  }],
  "filters": [
    {
      "type": "timeShort",
      "data": 10000  // 10 seconds
    },
    {
      "type": "sizePercentage",
      "data": {
        "min": [20, 20],  // Cars are bigger than people
        "max": [100, 100]
      }
    }
  ],
  "objectClassifications": [{
    "type": "vehicle",
    "subTypes": ["car", "truck"]
  }]
}
```

### Example 3: Entrance Counter
**Use Case**: Count people entering a store

```json
{
  "id": 3,
  "name": "Entry Count",
  "type": "crosslinecount",
  "enabled": true,
  "triggers": [{
    "type": "crossline",
    "vertices": [[-0.9, 0], [0.9, 0]]
  }],
  "objectClassifications": [{
    "type": "human"
  }],
  "metadata": {
    "crosslineDirection": "left-right"  // Into store
  }
}
```

### Example 4: Crowd Detection
**Use Case**: Alert when 5+ people gather

```json
{
  "id": 4,
  "name": "Crowd Alert",
  "type": "occupancy",
  "enabled": true,
  "triggers": [{
    "type": "includeArea",
    "vertices": [[-0.7, -0.7], [-0.7, 0.7], [0.7, 0.7], [0.7, -0.7]],
    "conditions": [{
      "type": "individualTimeInArea",
      "data": [{
        "type": "human",
        "time": 10,
        "alarmTime": 5
      }]
    }]
  }],
  "filters": [{
    "type": "timeShort",
    "data": 10000
  }],
  "objectClassifications": [{
    "type": "human"
  }],
  "metadata": {
    "occupancyThreshold": 5
  }
}
```

## API Usage

### Creating a Scenario via VAPIX

```javascript
// POST to /local/objectanalytics/control.cgi
const payload = {
  "apiVersion": "1.0",
  "method": "addConfiguration",
  "params": {
    "scenarios": [{
      // Your scenario JSON here
    }]
  }
};

// Send with digest authentication
await axios.post(
  `http://${cameraIp}/local/objectanalytics/control.cgi`,
  JSON.stringify(payload),
  {
    auth: {
      username: 'root',
      password: 'password'
    },
    headers: {
      'Content-Type': 'application/json'
    }
  }
);
```

### Using the AOAService Class

```javascript
import { AOAService } from './services/aoa/aoaService';

const aoa = new AOAService('192.168.1.100', 'root', 'password');

// Simple human detection with time filter
await aoa.createHumanDetectionScenario('Entrance', 10);

// Advanced scenario
await aoa.createAdvancedScenario({
  name: 'Loading Dock',
  type: 'occupancy',
  area: [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5]],
  objectTypes: {
    vehicles: true,
    vehicleSubTypes: ['truck']
  },
  filters: {
    timeInArea: 30,
    minimumSize: { width: 30, height: 30 }
  },
  occupancyThreshold: 2
});
```

## Important Notes

### Time in Area vs Filters
- **Filters** (`timeShort`): Use milliseconds, applied globally
- **Conditions** (`individualTimeInArea`): Use seconds, per-object tracking
- For Time in Area to work in UI, you need BOTH:
  1. Filter with milliseconds
  2. Condition with seconds

### Coordinate System
- Always use normalized coordinates (-1 to 1)
- Test with full area first: `[[-0.9, -0.9], [-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]]`
- Refine to specific zones after testing

### Scenario Limits
- Maximum 16 scenarios per camera
- Name limited to 15 characters
- Minimum 3 vertices for areas (except lines need exactly 2)

### Object Detection Accuracy
- Humans: Very reliable
- Vehicles: Good, especially with subtype filtering
- Small objects: Use size filters to reduce false positives
- Night vision: May need adjusted thresholds

## Troubleshooting

### Scenario Not Triggering
1. Check if AOA is licensed and running
2. Verify coordinates cover intended area
3. Ensure time filters aren't too restrictive
4. Check object classifications match what you're detecting

### Too Many False Positives
1. Add size filters
2. Increase time thresholds
3. Use swaying object filter for trees/flags
4. Reduce detection area size

### Time in Area Not Working
1. Ensure BOTH filter and condition are set
2. Filter uses milliseconds: `"data": 5000`
3. Condition uses seconds: `"time": 5`
4. Both must have similar values

## Natural Language Examples

When users type these descriptions, here's the JSON generated:

| User Input | Generated Type | Key Settings |
|------------|---------------|--------------|
| "Someone loitering" | motion | timeInArea: 10-30s |
| "Cars parking" | motion | vehicles, timeInArea: 10s |
| "People running" | motion | shortLivedLimit: 1-2s |
| "Crowd forming" | occupancy | threshold: 5+, timeInArea: 10s |
| "Counting entries" | crosslinecount | direction: specified |
| "Delivery trucks" | motion | vehicle:truck, timeInArea: 30s |

This specification provides everything needed to create and understand AOA scenarios programmatically.