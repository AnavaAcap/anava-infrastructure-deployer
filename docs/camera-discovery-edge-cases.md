# Camera Discovery Edge Cases & Solutions

## Overview

This document catalogs real-world edge cases encountered in camera discovery and provides specific solutions for each scenario. These cases were identified through analysis of the current implementation and common deployment patterns.

## Critical Edge Cases

### 1. HTTPS-Only Cameras with Self-Signed Certificates

**Problem**: Modern Axis cameras often default to HTTPS with self-signed certificates. Current implementation only supports HTTP on port 80.

**Impact**: Unable to discover secure-by-default cameras.

**Solution**:
```typescript
// Accept self-signed certificates during discovery only
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

// Validate it's actually a camera before trusting
const response = await axios.get(`https://${ip}:${port}/axis-cgi/param.cgi`, {
  httpsAgent,
  validateStatus: () => true
})
```

**User Experience**: Show certificate warning icon, allow user to review certificate details before configuration.

### 2. Cameras Behind Firewalls Blocking ICMP

**Problem**: Current implementation uses ping as first check. Many enterprise networks block ICMP but allow HTTP/HTTPS.

**Impact**: ~30% of cameras in enterprise environments may be missed.

**Solution**:
```typescript
// Skip ping, go straight to TCP connection attempt
async function checkCamera(ip: string): Promise<boolean> {
  // Try TCP connect instead of ICMP ping
  const socket = new net.Socket()
  return new Promise((resolve) => {
    socket.setTimeout(1000)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(80, ip)
  })
}
```

### 3. Non-Standard Ports (8080, 8000, 8443)

**Problem**: Cameras configured on alternative ports are invisible to current scanner.

**Examples**:
- Port 8080: Common HTTP alternative
- Port 8000: Development/testing deployments
- Port 8443: HTTPS alternative
- Port 81: Secondary HTTP

**Solution**:
```typescript
const CAMERA_PORTS = {
  priority: [443, 80],      // Check these first (90% of cameras)
  common: [8080, 8000],     // Then these (8% of cameras)
  extended: [8443, 81, 8081] // Finally these (2% of cameras)
}

// Scan priority ports first for faster discovery
const quickScan = await scanPorts(ip, CAMERA_PORTS.priority)
if (!quickScan.found) {
  const deepScan = await scanPorts(ip, [...CAMERA_PORTS.common, ...CAMERA_PORTS.extended])
}
```

### 4. Mixed Credential Environments

**Problem**: Different cameras in same network use different credentials. Current system assumes single credential set.

**Real Scenarios**:
- Legacy cameras: admin/admin
- New cameras: root/pass
- Customer-configured: custom/complex
- Open cameras: No authentication

**Solution**:
```typescript
class CredentialManager {
  private credentialSets: CredentialSet[] = [
    { id: 'default', username: 'root', password: 'pass', priority: 1 },
    { id: 'legacy', username: 'admin', password: 'admin', priority: 2 },
    { id: 'custom', username: '', password: '', priority: 3 }
  ]
  
  async tryAuthenticate(camera: Camera): Promise<AuthResult> {
    // Try no-auth first
    if (await this.tryNoAuth(camera)) {
      return { success: true, method: 'none' }
    }
    
    // Try each credential set
    for (const creds of this.credentialSets.sort((a, b) => a.priority - b.priority)) {
      if (await this.tryCredentials(camera, creds)) {
        // Remember which credentials worked for this camera
        this.cameraCredentials.set(camera.ip, creds.id)
        return { success: true, method: 'credentials', credentialId: creds.id }
      }
    }
    
    return { success: false, requiresManualAuth: true }
  }
}
```

### 5. Large Networks (1000+ IPs)

**Problem**: Scanning large networks sequentially takes too long and may trigger security alerts.

**Impact**: /16 network (65,536 IPs) would take hours.

**Solution**:
```typescript
// 1. Service discovery first (instant for responding devices)
const serviceDevices = await discoverViaBonjour()

// 2. Smart IP range detection
const activeRanges = await detectActiveSubnets(networkRange)

// 3. Concurrent scanning with rate limiting
const queue = new PQueue({ 
  concurrency: 50,
  interval: 1000,
  intervalCap: 100 // Max 100 requests per second
})

// 4. Progressive results
discoveryEngine.on('camera-found', (camera) => {
  // Show immediately, don't wait for full scan
  addCameraToUI(camera)
})
```

### 6. Cameras Requiring VPN or Special Network

**Problem**: Cameras on isolated networks or requiring VPN access.

**Examples**:
- DMZ cameras on different subnet
- Remote site cameras over VPN
- VLAN-isolated cameras

**Solution**:
```typescript
// 1. Detect all network interfaces
const interfaces = await getNetworkInterfaces()

// 2. Let user select which networks to scan
const selectedNetworks = await showNetworkSelectionDialog(interfaces)

// 3. Support manual entry for non-routable networks
const manualEntry = {
  ip: '10.50.0.100',
  port: 443,
  protocol: 'https',
  bypassDiscovery: true
}
```

### 7. HTTP/HTTPS Protocol Confusion

**Problem**: Camera supports both HTTP and HTTPS but on different ports. Current implementation might connect to wrong protocol.

**Solution**:
```typescript
async function detectProtocol(ip: string, port: number): Promise<string> {
  // Try HTTPS first (more secure)
  const httpsResult = await tryHttps(ip, port)
  if (httpsResult.success) return 'https'
  
  // Fall back to HTTP
  const httpResult = await tryHttp(ip, port)
  if (httpResult.success) return 'http'
  
  return 'unknown'
}

// Store protocol preference per camera
cameraConfig.preferredProtocol = detectedProtocol
```

### 8. Camera Model Filtering

**Problem**: Current implementation treats all Axis devices as cameras, including speakers and other devices.

**Solution**:
```typescript
// Enhanced device filtering
const CAMERA_MODELS = ['M30', 'P32', 'Q16', 'F34', 'M50']
const NON_CAMERA_KEYWORDS = ['speaker', 'audio', 'horn', 'intercom']

function isCamera(deviceInfo: any): boolean {
  const model = deviceInfo.ProdNbr || ''
  const type = deviceInfo.ProdType || ''
  
  // Reject known non-cameras
  if (NON_CAMERA_KEYWORDS.some(k => type.toLowerCase().includes(k))) {
    return false
  }
  
  // Accept known camera models
  if (CAMERA_MODELS.some(m => model.startsWith(m))) {
    return true
  }
  
  // Default: accept if has video capability
  return deviceInfo.capabilities?.includes('video')
}
```

### 9. Transient Network Issues

**Problem**: Temporary network issues cause false negatives.

**Solution**:
```typescript
// Implement retry with exponential backoff
async function resilientDiscover(ip: string, maxRetries = 3): Promise<Camera | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await discoverCamera(ip)
      if (result) return result
    } catch (error) {
      if (attempt === maxRetries) throw error
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000
      await sleep(delay)
    }
  }
  return null
}
```

### 10. Duplicate Camera Detection

**Problem**: Same camera accessible via multiple IPs (multi-homed) or discovered via multiple methods.

**Solution**:
```typescript
// Use MAC address as unique identifier
function deduplicateCameras(cameras: Camera[]): Camera[] {
  const unique = new Map<string, Camera>()
  
  for (const camera of cameras) {
    const key = camera.mac || `${camera.model}-${camera.serialNumber}`
    
    if (!unique.has(key)) {
      unique.set(key, camera)
    } else {
      // Merge information from duplicate
      const existing = unique.get(key)!
      existing.alternativeIPs = existing.alternativeIPs || []
      existing.alternativeIPs.push(camera.ip)
    }
  }
  
  return Array.from(unique.values())
}
```

## Quick Reference: Edge Case Solutions

| Edge Case | Current Behavior | Solution |
|-----------|------------------|----------|
| HTTPS cameras | Not discovered | Add HTTPS handler with self-signed cert support |
| Blocked ICMP | Marked as offline | Use TCP connection test instead |
| Non-standard ports | Invisible | Scan common camera ports |
| Mixed credentials | Auth fails | Multiple credential sets with per-camera storage |
| Large networks | Too slow | Service discovery + concurrent scanning |
| VPN cameras | Not accessible | Manual entry + network interface selection |
| Protocol confusion | Wrong protocol | Auto-detect and store preference |
| Non-camera devices | Listed as cameras | Model-based filtering |
| Network issues | False negatives | Retry with exponential backoff |
| Duplicate cameras | Listed multiple times | MAC-based deduplication |

## Implementation Priority

1. **High Priority** (Week 1)
   - HTTPS support
   - Multi-port scanning
   - TCP-based detection

2. **Medium Priority** (Week 2)
   - Service discovery
   - Credential management
   - Retry logic

3. **Low Priority** (Week 3+)
   - Advanced filtering
   - Network interface selection
   - Deduplication

## Testing Checklist

- [ ] HTTPS camera on port 443
- [ ] HTTP camera on port 8080
- [ ] Camera behind firewall blocking ping
- [ ] Network with 100+ cameras
- [ ] Mixed credential environment
- [ ] Camera with self-signed certificate
- [ ] Multi-homed camera (multiple IPs)
- [ ] Axis speaker (should be filtered out)
- [ ] Temporary network failure during scan
- [ ] VPN-connected camera