/**
 * VAPIX Schedule Service
 * Provides programmatic control of Axis camera schedules via VAPIX APIs
 * Based on official VAPIX Schedule Service documentation
 * https://developer.axis.com/vapix/physical-access-control/schedule-service/
 */

import axios from 'axios';
import crypto from 'crypto';
import https from 'https';
import { logger } from '../../utils/logger';
import { getCameraBaseUrl } from '../camera/cameraProtocolUtils';

// Schedule API types based on VAPIX Schedule Service documentation
export interface ScheduleEntry {
  id?: string;
  name: string;
  description?: string;
  scheduleType: 'weekly' | 'daily' | 'dateRange' | 'once';
  enabled: boolean;
  
  // Weekly schedule configuration
  weeklySchedule?: {
    monday?: TimeRange[];
    tuesday?: TimeRange[];
    wednesday?: TimeRange[];
    thursday?: TimeRange[];
    friday?: TimeRange[];
    saturday?: TimeRange[];
    sunday?: TimeRange[];
  };
  
  // Daily schedule configuration
  dailySchedule?: {
    timeRanges: TimeRange[];
  };
  
  // Date range schedule configuration
  dateRangeSchedule?: {
    startDate: string; // ISO date format YYYY-MM-DD
    endDate: string;   // ISO date format YYYY-MM-DD
    timeRanges: TimeRange[];
  };
  
  // One-time schedule configuration
  onceSchedule?: {
    date: string; // ISO date format YYYY-MM-DD
    timeRanges: TimeRange[];
  };
  
  // Metadata for integration with other services
  metadata?: {
    createdBy?: string;
    purpose?: string;
    associatedProfile?: string;
    visionArchitectGenerated?: boolean;
  };
}

export interface TimeRange {
  startTime: string; // HH:MM format (24-hour)
  endTime: string;   // HH:MM format (24-hour)
  description?: string;
}

export interface ScheduleCapabilities {
  maxSchedules: number;
  supportedTypes: string[];
  version: string;
  features: {
    weeklySchedules: boolean;
    dailySchedules: boolean;
    dateRangeSchedules: boolean;
    onceSchedules: boolean;
    overlappingSchedules: boolean;
  };
}

export interface ScheduleStatus {
  id: string;
  name: string;
  enabled: boolean;
  active: boolean; // Whether the schedule is currently active based on current time
  nextActivation?: string; // ISO datetime when schedule will next be active
  nextDeactivation?: string; // ISO datetime when schedule will next be inactive
}

export class ScheduleService {
  private cameraIp: string;
  private username: string;
  private password: string;

  constructor(cameraIp: string, username: string, password: string) {
    this.cameraIp = cameraIp;
    this.username = username;
    this.password = password;
  }

  /**
   * Get schedule service capabilities
   */
  async getCapabilities(): Promise<ScheduleCapabilities> {
    try {
      logger.info('[Schedule] Getting schedule service capabilities...');
      
      const response = await this.vapixRequest('POST', '/axis-cgi/schedule.cgi', {
        method: 'getCapabilities',
        apiVersion: '1.0'
      });
      
      if (response.data && response.data.data) {
        return response.data.data;
      }
      
      // Return default capabilities if not available
      return {
        maxSchedules: 100,
        supportedTypes: ['weekly', 'daily', 'dateRange', 'once'],
        version: '1.0',
        features: {
          weeklySchedules: true,
          dailySchedules: true,
          dateRangeSchedules: true,
          onceSchedules: true,
          overlappingSchedules: true
        }
      };
    } catch (error: any) {
      logger.error('[Schedule] Error getting capabilities:', error.message);
      throw error;
    }
  }

  /**
   * Create a new schedule
   */
  async createSchedule(schedule: ScheduleEntry): Promise<string> {
    try {
      logger.info('[Schedule] Creating schedule:', schedule.name);
      
      // Build VAPIX schedule format
      const vapixSchedule = this.toVapixFormat(schedule);
      
      const response = await this.vapixRequest('POST', '/axis-cgi/schedule.cgi', {
        method: 'add',
        apiVersion: '1.0',
        params: {
          schedule: vapixSchedule
        }
      });
      
      if (response.data && response.data.data && response.data.data.scheduleId) {
        const scheduleId = response.data.data.scheduleId;
        logger.info('[Schedule] Schedule created successfully with ID:', scheduleId);
        return scheduleId;
      }
      
      throw new Error('Failed to create schedule: No schedule ID returned');
    } catch (error: any) {
      logger.error('[Schedule] Error creating schedule:', error.message);
      throw error;
    }
  }

  /**
   * Get all configured schedules
   */
  async getSchedules(): Promise<ScheduleEntry[]> {
    try {
      logger.info('[Schedule] Getting all schedules...');
      
      const response = await this.vapixRequest('POST', '/axis-cgi/schedule.cgi', {
        method: 'list',
        apiVersion: '1.0'
      });
      
      if (response.data && response.data.data && response.data.data.schedules) {
        return response.data.data.schedules.map((s: any) => this.fromVapixFormat(s));
      }
      
      return [];
    } catch (error: any) {
      logger.error('[Schedule] Error getting schedules:', error.message);
      throw error;
    }
  }

  /**
   * Get a specific schedule by ID
   */
  async getSchedule(scheduleId: string): Promise<ScheduleEntry | null> {
    try {
      logger.info('[Schedule] Getting schedule:', scheduleId);
      
      const response = await this.vapixRequest('POST', '/axis-cgi/schedule.cgi', {
        method: 'get',
        apiVersion: '1.0',
        params: {
          scheduleId: scheduleId
        }
      });
      
      if (response.data && response.data.data && response.data.data.schedule) {
        return this.fromVapixFormat(response.data.data.schedule);
      }
      
      return null;
    } catch (error: any) {
      logger.error('[Schedule] Error getting schedule:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(scheduleId: string, schedule: ScheduleEntry): Promise<boolean> {
    try {
      logger.info('[Schedule] Updating schedule:', scheduleId);
      
      const vapixSchedule = this.toVapixFormat(schedule);
      vapixSchedule.scheduleId = scheduleId;
      
      const response = await this.vapixRequest('POST', '/axis-cgi/schedule.cgi', {
        method: 'update',
        apiVersion: '1.0',
        params: {
          schedule: vapixSchedule
        }
      });
      
      if (response.data && !response.data.error) {
        logger.info('[Schedule] Schedule updated successfully');
        return true;
      }
      
      return false;
    } catch (error: any) {
      logger.error('[Schedule] Error updating schedule:', error.message);
      throw error;
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<boolean> {
    try {
      logger.info('[Schedule] Deleting schedule:', scheduleId);
      
      const response = await this.vapixRequest('POST', '/axis-cgi/schedule.cgi', {
        method: 'remove',
        apiVersion: '1.0',
        params: {
          scheduleId: scheduleId
        }
      });
      
      if (response.data && !response.data.error) {
        logger.info('[Schedule] Schedule deleted successfully');
        return true;
      }
      
      return false;
    } catch (error: any) {
      logger.error('[Schedule] Error deleting schedule:', error.message);
      throw error;
    }
  }

  /**
   * Get schedule status (whether it's currently active)
   */
  async getScheduleStatus(scheduleId: string): Promise<ScheduleStatus | null> {
    try {
      logger.info('[Schedule] Getting schedule status:', scheduleId);
      
      const response = await this.vapixRequest('POST', '/axis-cgi/schedule.cgi', {
        method: 'getStatus',
        apiVersion: '1.0',
        params: {
          scheduleId: scheduleId
        }
      });
      
      if (response.data && response.data.data && response.data.data.status) {
        return response.data.data.status;
      }
      
      return null;
    } catch (error: any) {
      logger.error('[Schedule] Error getting schedule status:', error.message);
      throw error;
    }
  }

  /**
   * Enable or disable a schedule
   */
  async setScheduleEnabled(scheduleId: string, enabled: boolean): Promise<boolean> {
    try {
      logger.info(`[Schedule] ${enabled ? 'Enabling' : 'Disabling'} schedule:`, scheduleId);
      
      const response = await this.vapixRequest('POST', '/axis-cgi/schedule.cgi', {
        method: 'setEnabled',
        apiVersion: '1.0',
        params: {
          scheduleId: scheduleId,
          enabled: enabled
        }
      });
      
      if (response.data && !response.data.error) {
        logger.info('[Schedule] Schedule enabled state updated successfully');
        return true;
      }
      
      return false;
    } catch (error: any) {
      logger.error('[Schedule] Error setting schedule enabled state:', error.message);
      throw error;
    }
  }

  /**
   * Helper method to create common schedule types for Vision Architect
   */
  static createScheduleForVisionArchitect(config: {
    name: string;
    type: 'schoolHours' | 'businessHours' | 'afterHours' | 'weekends' | 'custom';
    timeRange?: TimeRange;
    customConfig?: Partial<ScheduleEntry>;
  }): ScheduleEntry {
    const { name, type, timeRange, customConfig } = config;
    
    let schedule: ScheduleEntry = {
      name: name,
      description: `Schedule created by Vision Architect for ${type} monitoring`,
      scheduleType: 'weekly',
      enabled: true,
      metadata: {
        createdBy: 'VisionArchitect',
        purpose: type,
        visionArchitectGenerated: true
      }
    };

    // Set default time ranges based on type
    switch (type) {
      case 'schoolHours':
        schedule.weeklySchedule = {
          monday: [{ startTime: '07:00', endTime: '17:00', description: 'School hours' }],
          tuesday: [{ startTime: '07:00', endTime: '17:00', description: 'School hours' }],
          wednesday: [{ startTime: '07:00', endTime: '17:00', description: 'School hours' }],
          thursday: [{ startTime: '07:00', endTime: '17:00', description: 'School hours' }],
          friday: [{ startTime: '07:00', endTime: '17:00', description: 'School hours' }]
        };
        break;
        
      case 'businessHours':
        schedule.weeklySchedule = {
          monday: [{ startTime: '08:00', endTime: '18:00', description: 'Business hours' }],
          tuesday: [{ startTime: '08:00', endTime: '18:00', description: 'Business hours' }],
          wednesday: [{ startTime: '08:00', endTime: '18:00', description: 'Business hours' }],
          thursday: [{ startTime: '08:00', endTime: '18:00', description: 'Business hours' }],
          friday: [{ startTime: '08:00', endTime: '18:00', description: 'Business hours' }]
        };
        break;
        
      case 'afterHours':
        schedule.weeklySchedule = {
          monday: [
            { startTime: '00:00', endTime: '08:00', description: 'After hours morning' },
            { startTime: '18:00', endTime: '23:59', description: 'After hours evening' }
          ],
          tuesday: [
            { startTime: '00:00', endTime: '08:00', description: 'After hours morning' },
            { startTime: '18:00', endTime: '23:59', description: 'After hours evening' }
          ],
          wednesday: [
            { startTime: '00:00', endTime: '08:00', description: 'After hours morning' },
            { startTime: '18:00', endTime: '23:59', description: 'After hours evening' }
          ],
          thursday: [
            { startTime: '00:00', endTime: '08:00', description: 'After hours morning' },
            { startTime: '18:00', endTime: '23:59', description: 'After hours evening' }
          ],
          friday: [
            { startTime: '00:00', endTime: '08:00', description: 'After hours morning' },
            { startTime: '18:00', endTime: '23:59', description: 'After hours evening' }
          ],
          saturday: [{ startTime: '00:00', endTime: '23:59', description: 'Weekend after hours' }],
          sunday: [{ startTime: '00:00', endTime: '23:59', description: 'Weekend after hours' }]
        };
        break;
        
      case 'weekends':
        schedule.weeklySchedule = {
          saturday: [{ startTime: '00:00', endTime: '23:59', description: 'Weekend monitoring' }],
          sunday: [{ startTime: '00:00', endTime: '23:59', description: 'Weekend monitoring' }]
        };
        break;
        
      case 'custom':
        if (timeRange) {
          // Apply custom time range to all days
          const customRange = [{ ...timeRange }];
          schedule.weeklySchedule = {
            monday: customRange,
            tuesday: customRange,
            wednesday: customRange,
            thursday: customRange,
            friday: customRange,
            saturday: customRange,
            sunday: customRange
          };
        }
        break;
    }

    // Apply any custom configuration overrides
    if (customConfig) {
      schedule = { ...schedule, ...customConfig };
    }

    return schedule;
  }

  /**
   * Convert our schedule format to VAPIX format
   */
  private toVapixFormat(schedule: ScheduleEntry): any {
    const vapixSchedule: any = {
      name: schedule.name,
      description: schedule.description || '',
      enabled: schedule.enabled,
      type: schedule.scheduleType
    };

    if (schedule.weeklySchedule) {
      vapixSchedule.weeklySchedule = {};
      Object.entries(schedule.weeklySchedule).forEach(([day, ranges]) => {
        if (ranges && ranges.length > 0) {
          vapixSchedule.weeklySchedule[day] = ranges.map(range => ({
            startTime: range.startTime,
            endTime: range.endTime,
            description: range.description
          }));
        }
      });
    }

    if (schedule.dailySchedule) {
      vapixSchedule.dailySchedule = {
        timeRanges: schedule.dailySchedule.timeRanges
      };
    }

    if (schedule.dateRangeSchedule) {
      vapixSchedule.dateRangeSchedule = schedule.dateRangeSchedule;
    }

    if (schedule.onceSchedule) {
      vapixSchedule.onceSchedule = schedule.onceSchedule;
    }

    if (schedule.metadata) {
      vapixSchedule.metadata = schedule.metadata;
    }

    return vapixSchedule;
  }

  /**
   * Convert VAPIX format to our schedule format
   */
  private fromVapixFormat(vapixSchedule: any): ScheduleEntry {
    const schedule: ScheduleEntry = {
      id: vapixSchedule.scheduleId || vapixSchedule.id,
      name: vapixSchedule.name,
      description: vapixSchedule.description,
      scheduleType: vapixSchedule.type,
      enabled: vapixSchedule.enabled
    };

    if (vapixSchedule.weeklySchedule) {
      schedule.weeklySchedule = vapixSchedule.weeklySchedule;
    }

    if (vapixSchedule.dailySchedule) {
      schedule.dailySchedule = vapixSchedule.dailySchedule;
    }

    if (vapixSchedule.dateRangeSchedule) {
      schedule.dateRangeSchedule = vapixSchedule.dateRangeSchedule;
    }

    if (vapixSchedule.onceSchedule) {
      schedule.onceSchedule = vapixSchedule.onceSchedule;
    }

    if (vapixSchedule.metadata) {
      schedule.metadata = vapixSchedule.metadata;
    }

    return schedule;
  }

  /**
   * Make authenticated VAPIX request (using same digest auth as AOA service)
   */
  private async vapixRequest(method: string, endpoint: string, data?: any): Promise<any> {
    try {
      const baseUrl = await getCameraBaseUrl(this.cameraIp, this.username, this.password);
      const url = `${baseUrl}${endpoint}`;
      
      logger.debug(`[Schedule] ${method} ${url}`);
      
      // First request to get digest challenge
      const isHttps = url.startsWith('https');
      const response1 = await axios({
        method,
        url,
        data: data ? JSON.stringify(data) : undefined,
        validateStatus: () => true,
        timeout: 20000,
        httpsAgent: isHttps ? new https.Agent({
          rejectUnauthorized: false
        }) : undefined,
      });

      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        
        if (wwwAuth && wwwAuth.toLowerCase().includes('basic')) {
          // Basic auth
          const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
          const response2 = await axios({
            method,
            url,
            data: data ? JSON.stringify(data) : undefined,
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            timeout: 20000,
            httpsAgent: isHttps ? new https.Agent({
              rejectUnauthorized: false
            }) : undefined,
          });
          
          if (response2.status === 200) {
            return response2;
          } else {
            throw new Error(`Request failed with status ${response2.status}`);
          }
        } else if (wwwAuth && wwwAuth.includes('Digest')) {
          // Digest auth (same implementation as AOAService)
          const digestData: any = {};
          const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
          let match;
          while ((match = regex.exec(wwwAuth)) !== null) {
            digestData[match[1]] = match[2] || match[3];
          }

          const nc = '00000001';
          const cnonce = crypto.randomBytes(8).toString('hex');
          const qop = digestData.qop || 'auth';

          const ha1 = crypto.createHash('md5')
            .update(`${this.username}:${digestData.realm}:${this.password}`)
            .digest('hex');

          const ha2 = crypto.createHash('md5')
            .update(`${method}:${endpoint}`)
            .digest('hex');

          const response = crypto.createHash('md5')
            .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
            .digest('hex');

          const authHeader = `Digest username="${this.username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${endpoint}", algorithm="${digestData.algorithm || 'MD5'}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;

          const headers: any = {
            'Authorization': authHeader
          };
          
          if (method === 'POST' && data) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data)).toString();
          }
          
          const response2 = await axios({
            method,
            url,
            data: data ? JSON.stringify(data) : undefined,
            headers,
            timeout: 20000,
            validateStatus: () => true,
            httpsAgent: isHttps ? new https.Agent({
              rejectUnauthorized: false
            }) : undefined,
          });

          logger.debug(`[Schedule] Response status: ${response2.status}`);
          return response2;
        }
      }
      
      if (response1.status === 200) {
        return response1;
      } else {
        throw new Error(`Request failed with status ${response1.status}`);
      }
    } catch (error: any) {
      logger.error(`[Schedule] Request error:`, error.message);
      throw error;
    }
  }
}

export default ScheduleService;