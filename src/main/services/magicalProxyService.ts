/**
 * Magical Proxy Service
 * Handles communication with the AI proxy backend for instant demos
 */

import { EventEmitter } from 'events';
import axios, { AxiosError } from 'axios';
import { getLogger } from '../utils/logger';
import crypto from 'crypto';
import os from 'os';

const logger = getLogger();

// Configuration
const PROXY_BASE_URL = process.env.AI_PROXY_URL || 'https://ai-proxy-anava-magical-backend.cloudfunctions.net';
const PROXY_ENDPOINTS = {
  analyze: '/ai-proxy',
  status: '/ai-proxy-status'
};

interface DeviceInfo {
  platform: string;
  hostname: string;
  networkInterfaces: string[];
  appVersion: string;
}

// Removed unused interface - responses are handled directly

interface DeviceStatus {
  device_id: string;
  status: 'new' | 'active' | 'limit_reached';
  requests_used: number;
  requests_remaining: number;
  daily_limit: number;
  created_at?: string;
}

export class MagicalProxyService extends EventEmitter {
  private deviceInfo: DeviceInfo;
  private deviceId?: string;

  constructor() {
    super();
    this.deviceInfo = this.collectDeviceInfo();
  }

  /**
   * Collect device information for consistent device ID generation
   */
  private collectDeviceInfo(): DeviceInfo {
    const networkInterfaces = os.networkInterfaces();
    const interfaces: string[] = [];

    // Collect MAC addresses for device fingerprinting
    Object.values(networkInterfaces).forEach(iface => {
      iface?.forEach(addr => {
        if (addr.mac && addr.mac !== '00:00:00:00:00:00') {
          interfaces.push(addr.mac);
        }
      });
    });

    return {
      platform: os.platform(),
      hostname: os.hostname(),
      networkInterfaces: interfaces.sort(), // Sort for consistency
      appVersion: process.env.npm_package_version || '0.9.63'
    };
  }

  /**
   * Get or generate device ID
   */
  private getDeviceId(): string {
    if (!this.deviceId) {
      // Generate consistent device ID from device info
      const deviceString = JSON.stringify(this.deviceInfo, null, 0);
      this.deviceId = crypto.createHash('sha256').update(deviceString).digest('hex').substring(0, 16);
    }
    return this.deviceId;
  }

  /**
   * Check device status and remaining quota
   */
  async checkDeviceStatus(): Promise<DeviceStatus> {
    try {
      const response = await axios.get(`${PROXY_BASE_URL}${PROXY_ENDPOINTS.status}`, {
        params: { device_id: this.getDeviceId() },
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Info': JSON.stringify(this.deviceInfo)
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to check device status:', error);
      throw new Error('Unable to check demo status');
    }
  }

  /**
   * Send image for AI analysis through proxy
   */
  async analyzeImage(imageBase64: string, prompt?: string): Promise<any> {
    try {
      const deviceId = this.getDeviceId();
      logger.info(`Sending image for analysis (device: ${deviceId})`);

      const payload = {
        model: 'gemini-1.5-flash',
        endpoint: 'generateContent',
        contents: [{
          parts: [
            {
              text: prompt || "Analyze this image and describe what you see. Focus on identifying people, objects, and any notable activities or safety concerns."
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageBase64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        },
        device_info: this.deviceInfo
      };

      const response = await axios.post(
        `${PROXY_BASE_URL}${PROXY_ENDPOINTS.analyze}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': deviceId
          },
          timeout: 30000 // 30 second timeout
        }
      );

      logger.info('AI analysis successful');
      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        
        if (axiosError.response?.status === 429) {
          // Rate limit exceeded
          const errorData = axiosError.response.data;
          logger.warn('Rate limit exceeded:', errorData.message);
          
          this.emit('rateLimitExceeded', {
            message: errorData.message,
            upgradeUrl: errorData.upgrade_url
          });
          
          throw new Error(errorData.message || 'Rate limit exceeded');
        }
        
        if (axiosError.response?.status === 503) {
          // Service unavailable
          logger.error('AI proxy service unavailable');
          throw new Error('AI service temporarily unavailable');
        }
      }

      logger.error('Failed to analyze image:', error);
      throw new Error('Failed to analyze image');
    }
  }

  /**
   * Generate a poetic first insight for the magical experience
   */
  async generateFirstInsight(imageBase64: string): Promise<string> {
    try {
      const prompt = `You are Anava Vision, an intelligent AI that has just awakened on a network camera. 
      Look at this scene and provide a single, poetic sentence that demonstrates your understanding. 
      Be specific about one interesting detail you observe. Keep it under 30 words.
      Focus on creating a sense of wonder and intelligence.`;

      const result = await this.analyzeImage(imageBase64, prompt);
      
      // Extract the text from Gemini response
      const candidates = result.candidates || [];
      if (candidates.length > 0 && candidates[0].content?.parts?.length > 0) {
        return candidates[0].content.parts[0].text;
      }
      
      return "I see a world full of patterns and possibilities, waiting to be understood.";
      
    } catch (error) {
      logger.error('Failed to generate first insight:', error);
      // Return a fallback poetic response
      return "In this moment, I observe the dance of light and shadow, each telling its own story.";
    }
  }

  /**
   * Handle user's custom analysis request
   */
  async analyzeWithUserPrompt(imageBase64: string, userPrompt: string): Promise<string> {
    try {
      const prompt = `You are Anava Vision, an intelligent camera AI. ${userPrompt}`;
      const result = await this.analyzeImage(imageBase64, prompt);
      
      // Extract the text from Gemini response
      const candidates = result.candidates || [];
      if (candidates.length > 0 && candidates[0].content?.parts?.length > 0) {
        return candidates[0].content.parts[0].text;
      }
      
      return "I couldn't process that request. Please try again.";
      
    } catch (error) {
      logger.error('Failed to analyze with user prompt:', error);
      throw error;
    }
  }

  /**
   * Check if device can use magical demo
   */
  async canUseMagicalDemo(): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const status = await this.checkDeviceStatus();
      
      if (status.status === 'limit_reached') {
        return {
          allowed: false,
          reason: `You've used all ${status.requests_used} demo requests. Please upgrade to continue.`
        };
      }
      
      if (status.requests_remaining < 10) {
        this.emit('lowQuota', {
          remaining: status.requests_remaining,
          total: status.requests_used
        });
      }
      
      return { allowed: true };
      
    } catch (error) {
      logger.error('Failed to check demo eligibility:', error);
      // Allow demo if we can't check status
      return { allowed: true };
    }
  }
}

// Export singleton instance
export const magicalProxyService = new MagicalProxyService();