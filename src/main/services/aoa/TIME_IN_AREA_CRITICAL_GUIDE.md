# CRITICAL GUIDE: Axis Object Analytics Time in Area Configuration

## ⚠️ THE PROBLEM
The "Time in Area" toggle in the Axis Object Analytics UI will show as **OFF** even when filters are correctly configured, unless you ALSO include trigger conditions.

## ✅ THE SOLUTION

### Required Components for Time in Area to Work:

1. **Filter Configuration** (sets the time duration):
```json
"filters": [{
  "type": "timeShort",
  "active": true,
  "data": 3000,  // Time in MILLISECONDS
  "time": 3000   // Include both properties for compatibility
}]
```

2. **Trigger Condition** (controls the UI toggle):
```json
"triggers": [{
  "type": "includeArea",
  "vertices": [...],
  "conditions": [{  // THIS IS CRITICAL!
    "type": "individualTimeInArea",
    "data": [{
      "type": "human",
      "time": 3,  // Time in SECONDS (not milliseconds!)
      "alarmTime": 1
    }]
  }]
}]
```

## 🔴 COMMON MISTAKE
```json
// WRONG - UI will show Time in Area as OFF
{
  "triggers": [{
    "type": "includeArea",
    "vertices": [...] 
    // Missing conditions!
  }],
  "filters": [{
    "type": "timeShort",
    "active": true,
    "data": 3000
  }]
}
```

## 🟢 CORRECT IMPLEMENTATION
```json
// CORRECT - UI will show Time in Area as ON
{
  "id": 1,
  "name": "Loitering",  // Keep names short!
  "type": "motion",
  "enabled": true,
  "devices": [{ "id": 1 }],
  "triggers": [{
    "type": "includeArea",
    "vertices": [
      [-0.8, -0.8],
      [-0.8, 0.8],
      [0.8, 0.8],
      [0.8, -0.8]
    ],
    "conditions": [{
      "type": "individualTimeInArea",
      "data": [{
        "type": "human",
        "time": 3,
        "alarmTime": 1
      }]
    }]
  }],
  "filters": [{
    "type": "timeShort",
    "active": true,
    "data": 3000,
    "time": 3000
  }],
  "objectClassifications": [{
    "type": "human",
    "selected": true
  }]
}
```

## 📝 KEY POINTS TO REMEMBER

1. **Units are different**:
   - Filters use **milliseconds** (`data: 3000` = 3 seconds)
   - Conditions use **seconds** (`time: 3` = 3 seconds)

2. **Both properties needed in filter**:
   - Include both `data` and `time` in timeShort filters
   - Some firmware versions use one, some use the other

3. **Scenario names must be short**:
   - Long names can cause error 2004
   - Keep under 20 characters when possible

4. **Object types must match**:
   - Condition data type must match objectClassifications
   - If detecting humans, condition must have type: "human"
   - If detecting vehicles, condition must have type: "vehicle"

5. **Multiple object types**:
   - Can have multiple items in the conditions data array
   - Each object type gets its own entry with time threshold

## 🔧 IMPLEMENTATION IN CODE

### TypeScript/JavaScript Example:
```typescript
// Using the AOAService
const aoa = new AOAService(cameraIp, username, password);

// This method already implements the correct structure
await aoa.createHumanDetectionScenario(
  'Loitering',  // name
  5,            // seconds for time in area
  [[-0.8, -0.8], [-0.8, 0.8], [0.8, 0.8], [0.8, -0.8]]  // area
);
```

### Raw VAPIX Request:
```bash
curl -X POST "http://${CAMERA_IP}/local/objectanalytics/control.cgi" \
  -u "${USERNAME}:${PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "setConfiguration",
    "apiVersion": "1.0",
    "context": "Anava",
    "params": {
      "scenarios": [{
        "id": 1,
        "name": "TimeInArea",
        "type": "motion",
        "enabled": true,
        "devices": [{"id": 1}],
        "triggers": [{
          "type": "includeArea",
          "vertices": [[-0.8,-0.8],[-0.8,0.8],[0.8,0.8],[0.8,-0.8]],
          "conditions": [{
            "type": "individualTimeInArea",
            "data": [{"type": "human", "time": 3, "alarmTime": 1}]
          }]
        }],
        "filters": [{
          "type": "timeShort",
          "active": true,
          "data": 3000,
          "time": 3000
        }],
        "objectClassifications": [{"type": "human", "selected": true}]
      }]
    }
  }'
```

## 🐛 DEBUGGING

### Check Current Configuration:
```bash
curl -X POST "http://${CAMERA_IP}/local/objectanalytics/control.cgi" \
  -u "${USERNAME}:${PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"method": "getConfiguration", "apiVersion": "1.0", "context": "Anava"}'
```

### What to Look For:
1. Check if `triggers[].conditions` exists
2. Verify `conditions[].type` is "individualTimeInArea"
3. Confirm `conditions[].data[].time` is in seconds
4. Ensure `filters[].data` and `filters[].time` are in milliseconds
5. Match object types between conditions and objectClassifications

## 🔗 REFERENCES

- This behavior was discovered through extensive testing
- NOT documented in official Axis VAPIX documentation
- Confirmed working on firmware versions 10.x and 11.x
- Tested with AOA versions 1.0 through 1.6

## 📅 DISCOVERY DATE
January 2025 - Discovered during Anava Infrastructure Deployer AOA integration development

---
**IMPORTANT**: This document represents undocumented but critical behavior for proper AOA configuration. Always test your scenarios in the Axis UI to verify the Time in Area toggle shows correctly.