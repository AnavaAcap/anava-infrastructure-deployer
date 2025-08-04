# Camera Discovery Sprint - Comprehensive Handoff Document

## Critical Issue to Solve FIRST

**URGENT**: User at 192.168.1.25 cannot discover cameras at 192.168.1.1, 192.168.1.2, 192.168.1.3, and 192.168.1.4 (all HTTP port 80).

### Root Cause Analysis Completed
1. **Ping failures on macOS** - needs TCP fallback
2. **Network range calculation bug** - subnet bit counting incorrect
3. **Too short timeouts** - need 3-5 second timeouts
4. **Sequential scanning** - too slow and triggers security alerts

## Current State

### Working Code Base
- **Main Service**: `/src/main/services/camera/cameraDiscoveryService.ts`
- **UI Component**: `/src/renderer/pages/camera/EnhancedCameraDiscoveryPage.tsx`
- **Configuration Service**: `/src/main/services/camera/cameraConfigurationService.ts`

### Critical Limitations Identified
1. **HTTP only** - no HTTPS support
2. **Single port** - only scans port 80
3. **Ping dependency** - fails on macOS
4. **Sequential scanning** - 12+ minutes for /24 network
5. **Insecure credentials** - stored in localStorage
6. **No service discovery** - missing mDNS/SSDP

## Specialized Agents Created (Need Access To)

### 1. Network Protocol & Security Specialist
**Purpose**: Deep networking protocols, TLS/SSL, security
**Needed For**:
- HTTPS with self-signed certificate handling
- mDNS/Bonjour and SSDP/UPnP implementation
- Secure credential storage with Electron's safeStorage
- Digest authentication security

### 2. Cross-Platform Systems Integration
**Purpose**: Platform-specific networking APIs
**Needed For**:
- Windows vs macOS networking differences
- Native Node.js addon development
- Electron main/renderer process optimization
- OS-specific certificate stores

### 3. QA & Network Testing Automation
**Purpose**: Testing network applications and edge cases
**Needed For**:
- Edge case testing scenarios
- Cross-platform validation
- Network environment simulation
- Performance benchmarking

### 4. Performance & Scalability Optimization
**Purpose**: Optimizing concurrent operations
**Needed For**:
- Concurrent scanning with p-queue
- Service discovery implementation
- Memory optimization for large scans
- Progressive result reporting

### 5. UX/UI Pattern Specialist
**Purpose**: Network/hardware configuration interfaces
**Needed For**:
- Real-time discovery feedback
- Error state communication
- Progressive disclosure patterns
- Accessibility improvements

## Implementation Priority for This Sprint

### Phase 1: Fix Current Discovery Issue (Today)
1. **Replace ping with TCP probing** - immediate fix for macOS
2. **Fix subnet calculation** - correct IP range generation
3. **Increase timeouts** - handle slow networks
4. **Add comprehensive logging** - debug remaining issues

### Phase 2: Performance & Multi-Protocol (Today)
1. **Implement concurrent scanning** - reduce scan time to <30 seconds
2. **Add HTTPS support** - self-signed certificate handling
3. **Multi-port scanning** - ports 443, 80, 8080, 8000, 8443
4. **Service discovery** - mDNS/SSDP for instant detection

### Phase 3: Security & UX (If Time)
1. **Secure credential storage** - Electron safeStorage API
2. **Real-time progress** - show cameras as found
3. **Manual camera entry** - bypass discovery for edge cases

## Key Files to Modify

### 1. Main Discovery Service
**File**: `/src/main/services/camera/cameraDiscoveryService.ts`
**Changes Needed**:
- Replace ping with TCP connection test
- Fix `getNetworkAddress()` subnet calculation
- Add concurrent scanning with p-queue
- Implement protocol handlers (HTTP/HTTPS)
- Add service discovery (mDNS/SSDP)

### 2. UI Component
**File**: `/src/renderer/pages/camera/EnhancedCameraDiscoveryPage.tsx`
**Changes Needed**:
- Replace localStorage with secure credential storage
- Add real-time discovery progress
- Add manual camera entry dialog
- Show protocol/port information per camera

### 3. Package Dependencies
**File**: `/package.json`
**Add Dependencies**:
```json
{
  "p-queue": "^6.6.2",
  "bonjour-service": "^1.2.1",
  "node-ssdp": "^4.0.1",
  "axios-digest-auth": "^0.7.0"
}
```

### 4. IPC Handlers
**File**: `/src/main/index.ts`
**Add Handlers**:
- `credentials:save` - secure credential storage
- `credentials:get` - secure credential retrieval
- `enhanced-scan-network` - new discovery engine
- `discover-service-cameras` - service discovery only

## Technical Architecture Decisions

### 1. Protocol Detection Strategy
```typescript
const CAMERA_PORTS = {
  priority: [443, 80],        // Check first (90% of cameras)
  common: [8080, 8000],       // Then these (8% of cameras)
  extended: [8443, 81, 8081]  // Finally these (2% of cameras)
}
```

### 2. Concurrent Scanning Pattern
```typescript
// Use p-queue with randomization to avoid IDS detection
const queue = new PQueue({ concurrency: 20 })
const shuffledIPs = shuffle(ipRange)
```

### 3. Service Discovery First
```typescript
// Try service discovery first, then active scanning
const serviceDevices = await Promise.all([
  discoverMDNS(), // Bonjour
  discoverSSDP()  // UPnP
])
```

## Success Metrics for Sprint

### Immediate Success (Fix Current Issue)
- [ ] User at .1.25 can discover cameras at .1.1-.1.4
- [ ] Scan completes in <60 seconds
- [ ] Works on both Windows and macOS

### Sprint Success (Enhanced Discovery)
- [ ] HTTPS cameras discovered automatically
- [ ] Service discovery finds cameras instantly
- [ ] Concurrent scanning reduces time to <30 seconds
- [ ] Secure credential storage implemented
- [ ] Real-time progress feedback

## Testing Checklist

### Critical Tests
- [ ] Same subnet discovery (192.168.1.x from 192.168.1.25)
- [ ] HTTPS cameras with self-signed certs
- [ ] Cameras on non-standard ports
- [ ] Large network scan (100+ IPs)
- [ ] Mixed credential environments

### Platform Tests
- [ ] macOS without sudo privileges
- [ ] Windows with firewall enabled
- [ ] Both platforms with VPN active

## Next Session Setup

When you start the new session with access to all specialized agents, use this prompt:

---

## Handoff Prompt for New Session

"I need to continue a camera discovery implementation sprint. Here's the context:

**CRITICAL ISSUE**: User at 192.168.1.25 cannot discover cameras at 192.168.1.1-.1.4 (HTTP port 80). Current implementation has ping failures on macOS, subnet calculation bugs, and performance issues.

**GOAL**: Build robust camera discovery supporting HTTP/HTTPS, multi-port scanning, service discovery (mDNS/SSDP), and secure credential management.

**SPECIALIZED AGENTS NEEDED**:
1. Network Protocol & Security Specialist - for HTTPS, mDNS/SSDP, secure credentials
2. Cross-Platform Systems Integration - for Windows/macOS compatibility  
3. Performance & Scalability Optimization - for concurrent scanning
4. QA & Network Testing Automation - for edge case testing
5. UX/UI Pattern Specialist - for real-time feedback

**FILES TO MODIFY**:
- `/src/main/services/camera/cameraDiscoveryService.ts` (main service)
- `/src/renderer/pages/camera/EnhancedCameraDiscoveryPage.tsx` (UI)
- `/package.json` (add p-queue, bonjour-service, node-ssdp)

**IMPLEMENTATION PHASES**:
1. Fix current ping/subnet issues (immediate)
2. Add HTTPS + multi-port + concurrent scanning
3. Implement mDNS/SSDP service discovery
4. Secure credential storage
5. Real-time UI feedback

Please coordinate all specialized agents to implement this systematically. Start with the critical issue fix, then build the enhanced features. Focus on functionality over testing initially - we're in design/implementation phase.

Reference the comprehensive handoff document at `/docs/camera-discovery-sprint-handoff.md` for full context."

---

This handoff document provides everything needed to continue the sprint with full access to the specialized agents. The new session can immediately start coordinating between all the agents to solve the critical issue and implement the enhanced discovery system.