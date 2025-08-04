# Camera Discovery Implementation Specification

## Overview

This document provides detailed technical specifications for implementing the enhanced camera discovery system. It includes code examples, API designs, and integration points with the existing codebase.

## Key Improvements Summary

### 1. Multi-Protocol Support (HTTP/HTTPS)
- Automatic protocol detection
- Self-signed certificate handling for discovery phase
- Fallback mechanisms

### 2. Intelligent Port Scanning
- Priority-based port scanning (443, 80 first)
- Common camera ports (8080, 8000, 8443)
- Configurable port lists

### 3. Service Discovery
- mDNS/Bonjour for Axis cameras
- SSDP/UPnP discovery
- Zero-configuration networking

### 4. Advanced Authentication
- Multiple credential sets
- Per-camera credential storage
- No-auth camera support

### 5. Enhanced UX
- Real-time discovery progress
- Manual camera addition
- Discovery profiles

## Detailed Implementation Plan

### Phase 1: Core Protocol Handlers

#### 1.1 Protocol Handler Interface
```typescript
// src/main/services/camera/protocols/ProtocolHandler.ts
export interface ConnectionResult {
  success: boolean
  protocol: 'http' | 'https'
  port: number
  responseTime: number
  error?: string
  certificateInfo?: {
    selfSigned: boolean
    issuer?: string
    validFrom?: Date
    validTo?: Date
  }
}

export interface ProtocolHandler {
  name: string
  defaultPorts: number[]
  
  tryConnect(
    ip: string, 
    port: number,
    timeout?: number
  ): Promise<ConnectionResult>
  
  validateAxisCamera(
    ip: string,
    port: number,
    credentials?: { username: string; password: string }
  ): Promise<boolean>
}
```

#### 1.2 HTTPS Handler Implementation
```typescript
// src/main/services/camera/protocols/HttpsHandler.ts
import https from 'https'
import axios from 'axios'
import { ProtocolHandler, ConnectionResult } from './ProtocolHandler'

export class HttpsHandler implements ProtocolHandler {
  name = 'https'
  defaultPorts = [443, 8443]
  
  async tryConnect(
    ip: string, 
    port: number,
    timeout = 3000
  ): Promise<ConnectionResult> {
    const startTime = Date.now()
    
    try {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false, // Accept self-signed certs
        timeout
      })
      
      const response = await axios.get(`https://${ip}:${port}/`, {
        httpsAgent,
        timeout,
        validateStatus: () => true // Don't throw on any status
      })
      
      const responseTime = Date.now() - startTime
      
      // Extract certificate info if available
      const socket = response.request.socket as any
      const cert = socket.getPeerCertificate?.()
      
      return {
        success: true,
        protocol: 'https',
        port,
        responseTime,
        certificateInfo: cert ? {
          selfSigned: cert.issuerCertificate === cert,
          issuer: cert.issuer?.CN,
          validFrom: new Date(cert.valid_from),
          validTo: new Date(cert.valid_to)
        } : undefined
      }
    } catch (error: any) {
      return {
        success: false,
        protocol: 'https',
        port,
        responseTime: Date.now() - startTime,
        error: error.message
      }
    }
  }
  
  async validateAxisCamera(
    ip: string,
    port: number,
    credentials?: { username: string; password: string }
  ): Promise<boolean> {
    try {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      })
      
      const url = `https://${ip}:${port}/axis-cgi/param.cgi`
      const response = await axios.get(url, {
        httpsAgent,
        timeout: 5000,
        validateStatus: () => true
      })
      
      // 401 means it's an Axis camera requiring auth
      // 200 means it's an open Axis camera
      return response.status === 401 || response.status === 200
    } catch {
      return false
    }
  }
}
```

### Phase 2: Port Scanner

#### 2.1 TCP Port Scanner
```typescript
// src/main/services/camera/scanner/PortScanner.ts
import net from 'net'
import { EventEmitter } from 'events'

export interface PortScanResult {
  port: number
  open: boolean
  service?: string
  responseTime?: number
}

export class PortScanner extends EventEmitter {
  private readonly timeout: number
  
  constructor(timeout = 1000) {
    super()
    this.timeout = timeout
  }
  
  async scanPort(ip: string, port: number): Promise<PortScanResult> {
    const startTime = Date.now()
    
    return new Promise((resolve) => {
      const socket = new net.Socket()
      let resolved = false
      
      const cleanup = () => {
        if (!resolved) {
          resolved = true
          socket.destroy()
        }
      }
      
      socket.setTimeout(this.timeout)
      
      socket.on('connect', () => {
        const responseTime = Date.now() - startTime
        cleanup()
        resolve({
          port,
          open: true,
          responseTime,
          service: this.guessService(port)
        })
      })
      
      socket.on('timeout', () => {
        cleanup()
        resolve({ port, open: false })
      })
      
      socket.on('error', () => {
        cleanup()
        resolve({ port, open: false })
      })
      
      socket.connect(port, ip)
    })
  }
  
  async scanPorts(
    ip: string, 
    ports: number[],
    concurrency = 10
  ): Promise<PortScanResult[]> {
    const results: PortScanResult[] = []
    const queue = [...ports]
    
    const workers = Array(concurrency).fill(null).map(async () => {
      while (queue.length > 0) {
        const port = queue.shift()
        if (port !== undefined) {
          const result = await this.scanPort(ip, port)
          results.push(result)
          this.emit('port-scanned', { ip, ...result })
        }
      }
    })
    
    await Promise.all(workers)
    return results.sort((a, b) => a.port - b.port)
  }
  
  private guessService(port: number): string | undefined {
    const services: Record<number, string> = {
      80: 'HTTP',
      443: 'HTTPS',
      554: 'RTSP',
      8080: 'HTTP-ALT',
      8443: 'HTTPS-ALT'
    }
    return services[port]
  }
}
```

### Phase 3: Service Discovery

#### 3.1 mDNS/Bonjour Discovery
```typescript
// src/main/services/camera/discovery/MDNSDiscovery.ts
import Bonjour from 'bonjour-service'
import { EventEmitter } from 'events'

export interface MDNSDevice {
  name: string
  ip: string
  port: number
  type: string
  model?: string
  txt?: Record<string, string>
}

export class MDNSDiscovery extends EventEmitter {
  private bonjour: any
  private browser: any
  
  constructor() {
    super()
    this.bonjour = new Bonjour()
  }
  
  async discoverAxisCameras(duration = 5000): Promise<MDNSDevice[]> {
    const devices: MDNSDevice[] = []
    
    return new Promise((resolve) => {
      // Axis cameras typically advertise as _axis-video._tcp
      this.browser = this.bonjour.find({
        type: 'axis-video',
        protocol: 'tcp'
      })
      
      this.browser.on('up', (service: any) => {
        const device: MDNSDevice = {
          name: service.name,
          ip: service.addresses[0], // IPv4 address
          port: service.port,
          type: service.type,
          model: service.txt?.model,
          txt: service.txt
        }
        
        devices.push(device)
        this.emit('device-found', device)
      })
      
      // Also look for generic HTTP services that might be cameras
      const httpBrowser = this.bonjour.find({
        type: 'http',
        protocol: 'tcp'
      })
      
      httpBrowser.on('up', (service: any) => {
        // Check if it might be a camera
        if (this.looksLikeCamera(service)) {
          const device: MDNSDevice = {
            name: service.name,
            ip: service.addresses[0],
            port: service.port,
            type: 'http',
            txt: service.txt
          }
          
          devices.push(device)
          this.emit('device-found', device)
        }
      })
      
      setTimeout(() => {
        this.browser.stop()
        httpBrowser.stop()
        resolve(devices)
      }, duration)
    })
  }
  
  private looksLikeCamera(service: any): boolean {
    const name = service.name?.toLowerCase() || ''
    const txt = service.txt || {}
    
    // Check for camera-related keywords
    const keywords = ['axis', 'camera', 'video', 'surveillance', 'ipcam']
    
    return keywords.some(keyword => 
      name.includes(keyword) || 
      Object.values(txt).some(v => 
        String(v).toLowerCase().includes(keyword)
      )
    )
  }
  
  stop() {
    if (this.browser) {
      this.browser.stop()
    }
  }
}
```

#### 3.2 SSDP/UPnP Discovery
```typescript
// src/main/services/camera/discovery/SSDPDiscovery.ts
import { Client as SSDPClient } from 'node-ssdp'
import { EventEmitter } from 'events'
import axios from 'axios'

export interface SSDPDevice {
  location: string
  ip: string
  port: number
  server?: string
  deviceInfo?: any
}

export class SSDPDiscovery extends EventEmitter {
  private client: any
  
  constructor() {
    super()
    this.client = new SSDPClient()
  }
  
  async discoverDevices(duration = 5000): Promise<SSDPDevice[]> {
    const devices: SSDPDevice[] = []
    const seen = new Set<string>()
    
    return new Promise((resolve) => {
      this.client.on('response', async (headers: any, statusCode: number, info: any) => {
        if (headers.LOCATION && !seen.has(headers.LOCATION)) {
          seen.add(headers.LOCATION)
          
          try {
            const device = await this.parseDevice(headers, info)
            if (device && this.looksLikeAxisCamera(device)) {
              devices.push(device)
              this.emit('device-found', device)
            }
          } catch (error) {
            // Ignore parse errors
          }
        }
      })
      
      // Search for all devices
      this.client.search('ssdp:all')
      
      // Also specifically search for Axis devices
      this.client.search('urn:axis-com:service:BasicService:1')
      
      setTimeout(() => {
        this.client.stop()
        resolve(devices)
      }, duration)
    })
  }
  
  private async parseDevice(headers: any, info: any): Promise<SSDPDevice | null> {
    try {
      const url = new URL(headers.LOCATION)
      
      const device: SSDPDevice = {
        location: headers.LOCATION,
        ip: url.hostname,
        port: parseInt(url.port) || 80,
        server: headers.SERVER
      }
      
      // Try to fetch device description
      try {
        const response = await axios.get(headers.LOCATION, {
          timeout: 2000,
          validateStatus: () => true
        })
        
        if (response.status === 200) {
          device.deviceInfo = response.data
        }
      } catch {
        // Ignore fetch errors
      }
      
      return device
    } catch {
      return null
    }
  }
  
  private looksLikeAxisCamera(device: SSDPDevice): boolean {
    const server = device.server?.toLowerCase() || ''
    const info = JSON.stringify(device.deviceInfo || {}).toLowerCase()
    
    return server.includes('axis') || 
           info.includes('axis') || 
           info.includes('camera') ||
           info.includes('network camera')
  }
  
  stop() {
    this.client.stop()
  }
}
```

### Phase 4: Discovery Orchestrator

#### 4.1 Main Discovery Engine
```typescript
// src/main/services/camera/CameraDiscoveryEngine.ts
import { EventEmitter } from 'events'
import PQueue from 'p-queue'
import { HttpHandler } from './protocols/HttpHandler'
import { HttpsHandler } from './protocols/HttpsHandler'
import { PortScanner } from './scanner/PortScanner'
import { MDNSDiscovery } from './discovery/MDNSDiscovery'
import { SSDPDiscovery } from './discovery/SSDPDiscovery'
import { CredentialManager } from './auth/CredentialManager'

export interface DiscoveryOptions {
  networkRange?: string
  ports?: number[]
  methods?: ('service' | 'active')[]
  timeout?: number
  concurrency?: number
}

export class CameraDiscoveryEngine extends EventEmitter {
  private protocolHandlers = new Map()
  private portScanner: PortScanner
  private mdnsDiscovery: MDNSDiscovery
  private ssdpDiscovery: SSDPDiscovery
  private credentialManager: CredentialManager
  private discoveryQueue: PQueue
  
  constructor() {
    super()
    
    // Initialize protocol handlers
    this.protocolHandlers.set('http', new HttpHandler())
    this.protocolHandlers.set('https', new HttpsHandler())
    
    // Initialize components
    this.portScanner = new PortScanner()
    this.mdnsDiscovery = new MDNSDiscovery()
    this.ssdpDiscovery = new SSDPDiscovery()
    this.credentialManager = new CredentialManager()
    
    // Discovery queue for controlled concurrency
    this.discoveryQueue = new PQueue({ concurrency: 20 })
    
    // Wire up events
    this.setupEventForwarding()
  }
  
  async discover(options: DiscoveryOptions = {}): Promise<Camera[]> {
    const {
      networkRange,
      ports = [443, 80, 8080, 8000, 8443],
      methods = ['service', 'active'],
      timeout = 5000
    } = options
    
    const cameras: Camera[] = []
    const discovered = new Map<string, Camera>()
    
    try {
      // Phase 1: Service Discovery (if enabled)
      if (methods.includes('service')) {
        this.emit('phase', { 
          phase: 'service-discovery', 
          message: 'Starting service discovery...' 
        })
        
        const [mdnsDevices, ssdpDevices] = await Promise.all([
          this.mdnsDiscovery.discoverAxisCameras(timeout),
          this.ssdpDiscovery.discoverDevices(timeout)
        ])
        
        // Process discovered services
        for (const device of [...mdnsDevices, ...ssdpDevices]) {
          const camera = await this.validateServiceDevice(device)
          if (camera && !discovered.has(camera.ip)) {
            discovered.set(camera.ip, camera)
            cameras.push(camera)
            this.emit('camera-found', camera)
          }
        }
      }
      
      // Phase 2: Active Scanning (if enabled)
      if (methods.includes('active') && networkRange) {
        this.emit('phase', { 
          phase: 'active-scanning', 
          message: 'Starting network scan...' 
        })
        
        const ips = this.generateIPRange(networkRange)
        
        // Scan IPs with controlled concurrency
        await this.discoveryQueue.addAll(
          ips.map(ip => async () => {
            // Skip if already discovered
            if (discovered.has(ip)) return
            
            const camera = await this.scanIP(ip, ports)
            if (camera) {
              discovered.set(camera.ip, camera)
              cameras.push(camera)
              this.emit('camera-found', camera)
            }
          })
        )
      }
      
      // Phase 3: Authentication
      this.emit('phase', { 
        phase: 'authentication', 
        message: 'Authenticating cameras...' 
      })
      
      for (const camera of cameras) {
        if (!camera.authenticated) {
          const authResult = await this.credentialManager.tryAuthenticate(camera)
          if (authResult.success) {
            camera.authenticated = true
            camera.credentials = authResult.credentials
            this.emit('camera-authenticated', camera)
          }
        }
      }
      
      return cameras
    } finally {
      // Cleanup
      this.mdnsDiscovery.stop()
      this.ssdpDiscovery.stop()
    }
  }
  
  private async scanIP(ip: string, ports: number[]): Promise<Camera | null> {
    this.emit('scan-progress', { ip, status: 'scanning' })
    
    // First, quick ping check (optional)
    const isAlive = await this.checkHost(ip)
    if (!isAlive) {
      this.emit('scan-progress', { ip, status: 'offline' })
      return null
    }
    
    // Port scan
    const openPorts = await this.portScanner.scanPorts(ip, ports, 5)
    const httpPorts = openPorts.filter(p => p.open)
    
    if (httpPorts.length === 0) {
      this.emit('scan-progress', { ip, status: 'no-http' })
      return null
    }
    
    // Try each open port with appropriate protocol
    for (const portResult of httpPorts) {
      const protocol = portResult.port === 443 || portResult.port === 8443 ? 'https' : 'http'
      const handler = this.protocolHandlers.get(protocol)
      
      if (handler) {
        const isAxis = await handler.validateAxisCamera(ip, portResult.port)
        if (isAxis) {
          this.emit('scan-progress', { ip, status: 'camera-found' })
          return this.createCamera(ip, portResult.port, protocol)
        }
      }
    }
    
    this.emit('scan-progress', { ip, status: 'not-camera' })
    return null
  }
  
  // ... Additional helper methods ...
}
```

### Phase 5: UI Enhancements

#### 5.1 Enhanced Discovery UI Component
```typescript
// Key UI improvements to EnhancedCameraDiscoveryPage.tsx

// 1. Real-time discovery feedback
interface DiscoveryEvent {
  id: string
  timestamp: Date
  type: 'service' | 'scan' | 'auth' | 'error'
  message: string
  details?: any
}

// 2. Manual camera addition dialog
interface ManualCameraConfig {
  ip: string
  port: number
  protocol: 'http' | 'https'
  username?: string
  password?: string
  skipValidation?: boolean
}

// 3. Discovery profiles
interface DiscoveryProfile {
  id: string
  name: string
  description: string
  config: {
    ports: number[]
    methods: ('service' | 'active')[]
    timeout: number
    networkRange?: string
  }
}

const DISCOVERY_PROFILES: DiscoveryProfile[] = [
  {
    id: 'quick',
    name: 'Quick Scan',
    description: 'Fast discovery using service discovery and common ports',
    config: {
      ports: [443, 80],
      methods: ['service'],
      timeout: 3000
    }
  },
  {
    id: 'standard',
    name: 'Standard Scan',
    description: 'Balanced discovery with service and active scanning',
    config: {
      ports: [443, 80, 8080, 8000],
      methods: ['service', 'active'],
      timeout: 5000
    }
  },
  {
    id: 'deep',
    name: 'Deep Scan',
    description: 'Comprehensive scan including uncommon ports',
    config: {
      ports: [443, 80, 8080, 8000, 8443, 81, 8081],
      methods: ['service', 'active'],
      timeout: 10000
    }
  }
]

// 4. Enhanced progress visualization
const DiscoveryProgress: React.FC = () => {
  return (
    <Box>
      <Stepper activeStep={phase}>
        <Step>
          <StepLabel>Service Discovery</StepLabel>
        </Step>
        <Step>
          <StepLabel>Network Scanning</StepLabel>
        </Step>
        <Step>
          <StepLabel>Authentication</StepLabel>
        </Step>
        <Step>
          <StepLabel>Complete</StepLabel>
        </Step>
      </Stepper>
      
      <Timeline>
        {events.map(event => (
          <TimelineItem key={event.id}>
            <TimelineSeparator>
              <TimelineDot color={getEventColor(event.type)} />
              <TimelineConnector />
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="caption">{event.timestamp.toLocaleTimeString()}</Typography>
              <Typography>{event.message}</Typography>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Box>
  )
}
```

## Integration Points

### 1. Update IPC Handlers
```typescript
// In main/index.ts
import { CameraDiscoveryEngine } from './services/camera/CameraDiscoveryEngine'

const discoveryEngine = new CameraDiscoveryEngine()

ipcMain.handle('enhanced-scan-network', async (event, options) => {
  // Forward events to renderer
  discoveryEngine.on('camera-found', (camera) => {
    event.sender.send('discovery-event', {
      type: 'camera-found',
      data: camera
    })
  })
  
  discoveryEngine.on('phase', (data) => {
    event.sender.send('discovery-phase', data)
  })
  
  return discoveryEngine.discover(options)
})
```

### 2. Update Preload Script
```typescript
// In preload.ts
enhancedScanNetwork: (options?: DiscoveryOptions) => 
  ipcRenderer.invoke('enhanced-scan-network', options),

onDiscoveryEvent: (callback: (event: DiscoveryEvent) => void) => {
  const listener = (_: any, data: any) => callback(data)
  ipcRenderer.on('discovery-event', listener)
  return () => ipcRenderer.removeListener('discovery-event', listener)
}
```

### 3. Package.json Dependencies
```json
{
  "dependencies": {
    "bonjour-service": "^1.2.1",
    "node-ssdp": "^4.0.1",
    "p-queue": "^6.6.2",
    "net": "^1.0.2"
  }
}
```

## Testing Strategy

### 1. Unit Tests
- Protocol handlers with mock servers
- Port scanner with known services
- Service discovery with mock broadcasts
- Credential manager with various scenarios

### 2. Integration Tests
- Full discovery flow with test network
- Cross-platform compatibility
- Performance benchmarks
- Error recovery scenarios

### 3. Manual Testing Checklist
- [ ] HTTPS cameras with self-signed certs
- [ ] Cameras on non-standard ports
- [ ] Mixed HTTP/HTTPS environments
- [ ] Large networks (>100 cameras)
- [ ] Cameras behind firewalls
- [ ] Multiple credential scenarios
- [ ] Service discovery on different networks
- [ ] Manual camera addition
- [ ] Discovery profiles
- [ ] Error handling and recovery

## Performance Considerations

1. **Concurrent Operations**: Use p-queue to limit concurrent connections
2. **Connection Pooling**: Reuse HTTP/HTTPS agents
3. **Caching**: Cache discovered devices for quick re-discovery
4. **Timeout Optimization**: Adjust timeouts based on network conditions
5. **Progressive Results**: Show cameras as they're found

## Security Considerations

1. **Certificate Validation**: Only accept self-signed certs during discovery
2. **Credential Storage**: Use Electron's safeStorage API
3. **Network Behavior**: Implement rate limiting to avoid triggering IDS
4. **User Consent**: Always get permission before scanning
5. **Audit Logging**: Log all discovery activities

## Migration Path

1. **Phase 1**: Add new discovery engine alongside existing
2. **Phase 2**: Feature flag to enable enhanced discovery
3. **Phase 3**: Gradual rollout with telemetry
4. **Phase 4**: Deprecate old discovery method
5. **Phase 5**: Remove legacy code

This implementation provides a robust, scalable solution for camera discovery that handles real-world network complexity while maintaining excellent user experience.