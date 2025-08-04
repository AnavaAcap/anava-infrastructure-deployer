/**
 * Magical AI Service
 * Handles direct AI interactions using user's own AI Studio API key
 */

import axios from 'axios';
import { getLogger } from '../utils/logger';

const logger = getLogger();

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export class MagicalAIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get the API key
   */
  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Analyze an image using Gemini Vision
   */
  async analyzeImage(imageBase64: string, prompt?: string): Promise<GeminiResponse> {
    try {
      const url = `${GEMINI_API_BASE}/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      
      const payload = {
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
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      logger.info('AI analysis successful');
      return response.data;

    } catch (error) {
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
   * Test if the API key is valid
   */
  async testAPIKey(): Promise<boolean> {
    try {
      const url = `${GEMINI_API_BASE}/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      
      const payload = {
        contents: [{
          parts: [{
            text: "Say 'Hello, Anava Vision is ready!' in exactly those words."
          }]
        }]
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return response.status === 200;
    } catch (error) {
      logger.error('API key test failed:', error);
      return false;
    }
  }
}

// Factory function to create service with API key
export const createMagicalAIService = (apiKey: string) => {
  return new MagicalAIService(apiKey);
};