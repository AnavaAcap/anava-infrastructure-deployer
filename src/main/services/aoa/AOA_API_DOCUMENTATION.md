# Axis Object Analytics (AOA) VAPIX API Implementation

## ⚠️ CRITICAL DISCOVERY: Time in Area UI Toggle Control

**The "Time in Area" toggle in the AOA UI requires BOTH filter AND trigger condition configuration!**

This is NOT documented in the official Axis documentation but is essential for proper UI display:

### ✅ CORRECT Configuration (UI shows Time in Area as ON):
```json
{
  "triggers": [{
    "type": "includeArea",
    "vertices": [...],
    "conditions": [{  // THIS IS CRITICAL!
      "type": "individualTimeInArea",
      "data": [{
        "type": "human",
        "time": 3,  // SECONDS (not milliseconds!)
        "alarmTime": 1
      }]
    }]
  }],
  "filters": [{
    "type": "timeShort",
    "active": true,
    "data": 3000,  // MILLISECONDS
    "time": 3000   // Include both for compatibility
  }]
}
```

### ❌ INCORRECT Configuration (UI shows Time in Area as OFF):
```json
{
  "triggers": [{
    "type": "includeArea",
    "vertices": [...]
    // Missing conditions array!
  }],
  "filters": [{
    "type": "timeShort",
    "active": true,
    "data": 3000
  }]
}
```

### Key Implementation Details:
1. **Filters use milliseconds** (`data: 3000` = 3 seconds)
2. **Conditions use seconds** (`time: 3` = 3 seconds)
3. **Both `data` and `time` properties** should be included in timeShort filters
4. **Scenario names must be short** - Long names cause error 2004
5. **API versions**: 1.0 through 1.6 supported (use 1.0 for compatibility)

## Overview

This module provides complete programmatic control of Axis Object Analytics (AOA) through VAPIX APIs, based on the official Axis documentation and following the existing VAPIX patterns in the Anava installer codebase.

## Key Features

- ✅ Full VAPIX API implementation for AOA control
- ✅ Digest/Basic authentication support (same as existing camera config)
- ✅ Scenario creation and management
- ✅ Human detection with configurable time-in-area triggers
- ✅ Multiple scenario types: motion, fence, crossline counting, occupancy
- ✅ Integration with Anava installer deployment flow
- ✅ Demo configuration setup for testing

## Architecture

### Core Components

1. **AOAService** (`aoaService.ts`)
   - Low-level VAPIX API wrapper
   - Direct control of AOA application
   - Scenario CRUD operations
   - Configuration management

2. **AOAIntegration** (`aoaIntegration.ts`)
   - High-level integration with installer
   - IPC handlers for Electron
   - Deployment workflow integration
   - Simplified configuration interface

3. **AOADiscovery** (`aoaDiscovery.ts`)
   - Network traffic monitoring with Puppeteer
   - Endpoint discovery tool
   - API reverse engineering utility

## VAPIX Endpoints

### Primary Control Endpoint
```
POST /local/objectanalytics/control.cgi
```

### Supported Methods

| Method | Description | Required Auth |
|--------|-------------|---------------|
| `getSupportedVersions` | Get API versions | Operator |
| `getConfigurationCapabilities` | Get max scenarios, types | Operator |
| `getConfiguration` | Get current config | Operator |
| `setConfiguration` | Set complete config | Admin |
| `sendAlarmEvent` | Trigger test event | Operator |
| `getAccumulatedCounts` | Get counting data | Operator |
| `resetAccumulatedCounts` | Reset counters | Admin |

### Application Control
```
GET /axis-cgi/applications/control.cgi?action=start&package=objectanalytics
GET /axis-cgi/applications/control.cgi?action=stop&package=objectanalytics
GET /axis-cgi/applications/list.cgi
```

## Scenario Configuration

### Scenario Types

1. **Motion Detection** (`motion`)
   - Detects movement in specified area
   - Supports time-in-area filtering

2. **Fence/Perimeter** (`fence`)
   - Virtual fence line crossing
   - Directional alerts (in/out/both)

3. **Crossline Counting** (`crosslinecount`)
   - Counts objects crossing a line
   - Directional counting

4. **Occupancy** (`occupancy`)
   - Monitors area occupancy levels
   - Threshold-based alerts

### Object Classifications

- `human` - Person detection
- `vehicle` - All vehicles
- `car`, `bus`, `truck` - Vehicle subtypes
- `bike` - Bicycles
- `other` - Unclassified objects

### Coordinate System

AOA uses normalized coordinates from -1 to 1:
- Top-left: `[-1, -1]`
- Top-right: `[1, -1]`
- Bottom-left: `[-1, 1]`
- Bottom-right: `[1, 1]`

## Usage Examples

### Basic Setup

```typescript
import { AOAService } from './services/aoa';

const aoa = new AOAService('192.168.1.100', 'admin', 'password');

// Start AOA application
await aoa.startAOA();

// Check status
const status = await aoa.getStatus();
console.log('AOA Running:', status.running);
console.log('Licensed:', status.licensed);
```

### Create Human Detection Scenario with Time in Area

```typescript
// CORRECT: Creates scenario with Time in Area properly enabled in UI
await aoa.createHumanDetectionScenario(
  'Entrance Monitor',  // name (keep short!)
  3,                  // seconds in area
  [                   // optional custom area
    [-0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
    [0.5, -0.5]
  ]
);

// This will create BOTH:
// 1. Filter: { type: 'timeShort', data: 3000, time: 3000 }
// 2. Trigger condition: { type: 'individualTimeInArea', data: [{ type: 'human', time: 3, alarmTime: 1 }] }
```

### Create Custom Scenario

```typescript
// Example 1: Vehicle Counter (no Time in Area)
const vehicleCounter = {
  id: 1,
  name: 'VehicleCount',  // Keep names short!
  type: 'crosslinecount',
  devices: [{ id: 1 }],
  triggers: [{
    type: 'countingLine',
    vertices: [[-0.9, 0], [0.9, 0]], // Horizontal line
    direction: 'both'
  }],
  objectClassifications: [
    { type: 'vehicle', selected: true }
  ]
};

// Example 2: Motion Detection WITH Time in Area (UI toggle ON)
const loiteringDetection = {
  id: 2,
  name: 'Loitering',  // Short name to avoid error 2004
  type: 'motion',
  devices: [{ id: 1 }],
  triggers: [{
    type: 'includeArea',
    vertices: [[-0.8, -0.8], [-0.8, 0.8], [0.8, 0.8], [0.8, -0.8]],
    conditions: [{  // CRITICAL for UI toggle!
      type: 'individualTimeInArea',
      data: [{
        type: 'human',
        time: 5,  // 5 SECONDS
        alarmTime: 1
      }]
    }]
  }],
  filters: [{
    type: 'timeShort',
    active: true,
    data: 5000,  // 5000 MILLISECONDS
    time: 5000   // Include both properties
  }],
  objectClassifications: [
    { type: 'human', selected: true }
  ]
};

await aoa.createScenario(vehicleCounter);
await aoa.createScenario(loiteringDetection);
```

### Integration with Installer

```typescript
import { AOAIntegration } from './services/aoa';

// During camera deployment
await AOAIntegration.configureAOA(camera, {
  enableAOA: true,
  scenarios: [{
    name: 'Main Entrance',
    type: 'motion',
    humanDetection: true,
    timeInArea: 3
  }, {
    name: 'Parking Area',
    type: 'crosslinecount',
    vehicleDetection: true
  }]
});
```

### Setup Demo Configuration

```typescript
// Quick setup with 4 pre-configured scenarios
await aoa.setupDemoConfiguration();
```

## Testing

### Manual Test Script

```bash
# Run the test script
npx ts-node src/main/services/aoa/testAOA.ts
```

### Discover Endpoints (Development)

```typescript
import { AOADiscovery } from './services/aoa';

const discovery = new AOADiscovery('192.168.1.100', 'admin', 'password');
const endpoints = await discovery.discoverEndpoints();
await discovery.exportEndpoints('./aoa-endpoints.json');
```

## Authentication

The service uses the same digest authentication pattern as the existing camera configuration:

1. First request without auth to get challenge
2. Parse WWW-Authenticate header
3. Build digest auth response with MD5 hashing
4. Retry request with Authorization header

Falls back to Basic auth if digest is not supported.

## Error Handling

Common error scenarios and responses:

| Error | Cause | Solution |
|-------|-------|----------|
| 404 Not Found | AOA not installed | Install AOA ACAP first |
| 401 Unauthorized | Invalid credentials | Check username/password |
| 403 Forbidden | Insufficient permissions | Use admin account |
| 500 Server Error | AOA crash or config error | Restart AOA, check logs |
| ECONNREFUSED | Camera unreachable | Check network/IP |

## Integration Points

### IPC Handlers

```typescript
// Available IPC channels
'configure-aoa'      // Configure AOA during deployment
'get-aoa-status'     // Get current AOA status
'create-aoa-scenario' // Create single scenario
'test-aoa-connection' // Test if AOA is available
```

### Deployment Flow

1. Deploy ACAP packages (including AOA if needed)
2. Activate AOA license
3. Start AOA application
4. Configure scenarios based on deployment config
5. Verify configuration

## Best Practices

1. **Always check if AOA is licensed** before configuration
2. **Start AOA application** before making configuration calls
3. **Use normalized coordinates** (-1 to 1) for all vertices
4. **Validate scenario IDs** are unique when creating
5. **Handle network errors** with retry logic
6. **Clean up old scenarios** before deploying new config
7. **For Time in Area**: Always include BOTH filter AND trigger condition
8. **Keep scenario names short** to avoid error 2004
9. **Include both `data` and `time`** properties in timeShort filters
10. **Remember unit differences**: Filters use milliseconds, conditions use seconds

## Troubleshooting

### AOA Won't Start
- Check if ACAP is installed: `/axis-cgi/applications/list.cgi`
- Verify license status
- Check camera resources (CPU/memory)

### Configuration Not Saving
- Ensure using admin credentials
- Check if AOA is running first
- Validate JSON payload format

### Scenarios Not Triggering
- Verify object classifications are correct
- Check filter settings (time thresholds)
- Ensure area/line coordinates are valid
- Test with `sendAlarmEvent` method

### Time in Area Toggle Shows as OFF in UI
- **Most common issue!** Missing `conditions` array in trigger
- Ensure trigger has `conditions` with `individualTimeInArea` type
- Check that condition `time` is in seconds, not milliseconds
- Verify both `data` and `time` properties exist in filter
- Condition data must match selected object types (human/vehicle)

## References

- [Axis Object Analytics API Documentation](https://developer.axis.com/vapix/applications/axis-object-analytics-api/)
- [VAPIX Library](https://www.axis.com/vapix-library/)
- [Axis ACAP Documentation](https://developer.axis.com/)

## License

This implementation follows the existing Anava installer patterns and is part of the Anava Infrastructure Deployer project.