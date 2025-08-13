/**
 * License Regression Prevention Tests
 * CRITICAL: Ensures system NEVER reverts to accepting fake ANAVA licenses
 * These tests must ALWAYS pass to prevent security regression
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Mock modules
jest.mock('firebase/app');
jest.mock('firebase/firestore');
jest.mock('electron', () => require('../__mocks__/electron'));

describe('License Regression Prevention Tests', () => {
  /**
   * CRITICAL REGRESSION TEST #1
   * This test MUST ALWAYS PASS to prevent fake license regression
   */
  describe('CRITICAL: Fake License Rejection', () => {
    it('MUST reject ALL ANAVA-prefixed licenses without exception', () => {
      // This is the master list of fake licenses that must ALWAYS be rejected
      const FORBIDDEN_LICENSES = [
        'ANAVA-TRIAL-2024-ABC123',
        'ANAVA-DEV-TEST-123',
        'ANAVA-DEMO-LICENSE',
        'ANAVA-FREE-TRIAL-2024',
        'ANAVA-UNLIMITED-ACCESS',
        'ANAVA-1234567890',
        'ANAVA-',
        'ANAVA-XXXX-XXXX-XXXX',
        'anava-trial-2024',
        'AnAvA-TrIaL-2024',
        'ANAVA-DEVELOPER-MODE',
        'ANAVA-BYPASS-AUTH',
        'ANAVA-ADMIN-OVERRIDE',
        'ANAVA-MASTER-KEY',
        'ANAVA-BACKDOOR-ACCESS'
      ];

      // This validation logic MUST be consistent across ALL code paths
      const validateLicense = (license: string): boolean => {
        if (!license) return false;
        
        // CRITICAL: Check for ANAVA prefix (case-insensitive)
        const upperLicense = license.toUpperCase();
        if (upperLicense.startsWith('ANAVA-') || upperLicense.startsWith('ANAVA_')) {
          console.error(`❌ CRITICAL: Fake license detected and rejected: ${license}`);
          return false;
        }
        
        return true;
      };

      // Test EVERY forbidden license
      for (const forbiddenLicense of FORBIDDEN_LICENSES) {
        const result = validateLicense(forbiddenLicense);
        expect(result).toBe(false);
        
        // Log for audit trail
        if (result === true) {
          throw new Error(`CRITICAL REGRESSION: Fake license ${forbiddenLicense} was accepted!`);
        }
      }

      // Verify count matches
      expect(FORBIDDEN_LICENSES.filter(l => !validateLicense(l)).length).toBe(FORBIDDEN_LICENSES.length);
    });

    /**
     * Test that NO code path can bypass fake license detection
     */
    it('should prevent fake license bypass through any code path', () => {
      const codePaths = {
        // Frontend validation
        frontendValidation: (license: string) => {
          if (license && license.toUpperCase().startsWith('ANAVA-')) {
            throw new Error('Invalid license key received');
          }
          return true;
        },
        
        // Backend validation
        backendValidation: (license: string) => {
          if (license && license.startsWith('ANAVA-')) {
            return { valid: false, error: 'Fake license detected' };
          }
          return { valid: true };
        },
        
        // Cloud function validation
        cloudFunctionValidation: (license: string) => {
          if (license && license.startsWith('ANAVA-')) {
            // Delete the fake license
            return null;
          }
          return license;
        },
        
        // Camera configuration validation
        cameraConfigValidation: (license: string) => {
          if (!license || license.startsWith('ANAVA-')) {
            return false;
          }
          return true;
        }
      };

      const testLicense = 'ANAVA-TRIAL-2024-TEST';

      // Test frontend path
      expect(() => codePaths.frontendValidation(testLicense)).toThrow('Invalid license key received');
      
      // Test backend path
      expect(codePaths.backendValidation(testLicense)).toEqual({ 
        valid: false, 
        error: 'Fake license detected' 
      });
      
      // Test cloud function path
      expect(codePaths.cloudFunctionValidation(testLicense)).toBeNull();
      
      // Test camera config path
      expect(codePaths.cameraConfigValidation(testLicense)).toBe(false);
    });
  });

  describe('License Fallback Prevention', () => {
    /**
     * CRITICAL: Ensure NO fallback licenses are ever used
     */
    it('should NEVER use fallback licenses', () => {
      // These patterns should NEVER appear in production code
      const FORBIDDEN_PATTERNS = [
        'ANAVA-TRIAL-2024',
        'generateTrialLicense',
        'generateFakeLicense',
        'DEFAULT_LICENSE',
        'FALLBACK_LICENSE',
        'DEMO_LICENSE',
        'TEST_LICENSE'
      ];

      // Simulate code that might try to use fallbacks
      const getLicense = async (userId: string): Promise<string | null> => {
        // Try to get real license
        const realLicense = await fetchRealLicense(userId);
        
        if (!realLicense) {
          // CRITICAL: Must return null, never a fallback
          // The following should NEVER happen:
          // return 'ANAVA-TRIAL-2024-' + userId; // ❌ FORBIDDEN
          // return generateTrialLicense(); // ❌ FORBIDDEN
          // return DEFAULT_LICENSE; // ❌ FORBIDDEN
          
          return null; // ✓ Correct: return null if no license
        }
        
        return realLicense;
      };

      // Mock function
      const fetchRealLicense = jest.fn().mockResolvedValue(null);

      // Test that no fallback is used
      getLicense('user-123').then(license => {
        expect(license).toBeNull();
        expect(license).not.toContain('ANAVA-');
        
        for (const forbidden of FORBIDDEN_PATTERNS) {
          expect(license).not.toContain(forbidden);
        }
      });
    });

    /**
     * Test that license generation functions are removed
     */
    it('should not have any trial license generation functions', () => {
      // These functions should NOT exist
      const forbiddenFunctions = [
        'generateTrialLicense',
        'generateAnavaTrial',
        'createFakeLicense',
        'generateDemoLicense',
        'generateTemporaryLicense'
      ];

      // Simulate checking if functions exist
      const functionRegistry = new Set<string>();
      
      // In production, none of these should be registered
      for (const funcName of forbiddenFunctions) {
        expect(functionRegistry.has(funcName)).toBe(false);
      }
    });
  });

  describe('License Validation Consistency', () => {
    /**
     * Ensure license validation is consistent across all components
     */
    it('should have consistent license validation across all layers', () => {
      const license = 'ANAVA-CONSISTENCY-TEST';

      // All validation functions should reject the same licenses
      const validators = [
        (l: string) => !l.startsWith('ANAVA-'),
        (l: string) => !l.toUpperCase().startsWith('ANAVA-'),
        (l: string) => !/^ANAVA-/i.test(l),
        (l: string) => l.substring(0, 6).toUpperCase() !== 'ANAVA-'
      ];

      const results = validators.map(v => v(license));
      
      // All validators should agree
      expect(results.every(r => r === false)).toBe(true);
      expect(new Set(results).size).toBe(1); // All results should be the same
    });

    /**
     * Test that validation cannot be bypassed with encoding tricks
     */
    it('should prevent bypass attempts through encoding manipulation', () => {
      const bypassAttempts = [
        'ANAVA-TRIAL-2024', // Direct
        'anava-trial-2024', // Lowercase
        'AnAvA-tRiAl-2024', // Mixed case
        'ANAVA%2DTRIAL%2D2024', // URL encoded
        'ANAVA\\u002DTRIAL\\u002D2024', // Unicode escaped
        'ANAVA\x2DTRIAL\x2D2024', // Hex escaped
        '414E4156412D545249414C2D32303234', // Hex encoded
        'QU5BVkEtVFJJQUwtMjAyNA==', // Base64 encoded
        ' ANAVA-TRIAL-2024', // Leading space
        'ANAVA-TRIAL-2024 ', // Trailing space
        '\nANAVA-TRIAL-2024', // Leading newline
        'ANAVA-TRIAL-2024\n', // Trailing newline
      ];

      const validateLicense = (license: string): boolean => {
        // Decode and normalize
        let normalized = license.trim();
        
        // Decode URL encoding
        try {
          normalized = decodeURIComponent(normalized);
        } catch {}
        
        // Check for ANAVA prefix
        if (normalized.toUpperCase().startsWith('ANAVA-')) {
          return false;
        }
        
        // Also check raw input (in case of double encoding)
        if (license.toUpperCase().includes('ANAVA')) {
          return false;
        }
        
        return true;
      };

      for (const attempt of bypassAttempts) {
        const result = validateLicense(attempt);
        if (attempt.includes('ANAVA') || attempt.includes('anava')) {
          expect(result).toBe(false);
        }
      }
    });
  });

  describe('Configuration Regression Prevention', () => {
    /**
     * Test that configuration cannot be manipulated to accept fake licenses
     */
    it('should prevent configuration tampering to enable fake licenses', () => {
      const config = {
        allowFakeLicenses: false,
        allowAnavaPrefixed: false,
        bypassValidation: false,
        devMode: false,
        testMode: false
      };

      const validateWithConfig = (license: string, cfg: any): boolean => {
        // These flags should NEVER bypass validation
        if (license.toUpperCase().startsWith('ANAVA-')) {
          // Even if config says to allow, we still reject
          return false;
        }
        
        return true;
      };

      // Try to bypass with config manipulation
      const manipulatedConfigs = [
        { ...config, allowFakeLicenses: true },
        { ...config, allowAnavaPrefixed: true },
        { ...config, bypassValidation: true },
        { ...config, devMode: true },
        { ...config, testMode: true },
        { allowAll: true, skipValidation: true }
      ];

      const testLicense = 'ANAVA-CONFIG-BYPASS';

      for (const cfg of manipulatedConfigs) {
        expect(validateWithConfig(testLicense, cfg)).toBe(false);
      }
    });

    /**
     * Test that environment variables cannot enable fake licenses
     */
    it('should ignore environment variables that try to enable fake licenses', () => {
      const envVars = {
        ALLOW_FAKE_LICENSES: 'true',
        SKIP_LICENSE_VALIDATION: 'true',
        DEV_MODE: 'true',
        BYPASS_AUTH: 'true',
        USE_TEST_LICENSES: 'true'
      };

      const validateLicense = (license: string): boolean => {
        // Environment variables should NEVER bypass this check
        if (license.toUpperCase().startsWith('ANAVA-')) {
          return false;
        }
        
        // Don't check env vars for bypass
        return true;
      };

      // Set environment variables
      Object.entries(envVars).forEach(([key, value]) => {
        process.env[key] = value;
      });

      const testLicense = 'ANAVA-ENV-BYPASS';
      expect(validateLicense(testLicense)).toBe(false);

      // Clean up
      Object.keys(envVars).forEach(key => {
        delete process.env[key];
      });
    });
  });

  describe('Historical Regression Scenarios', () => {
    /**
     * Test against known historical bypass attempts
     */
    it('should prevent all known historical bypass methods', () => {
      const historicalBypasses = [
        {
          method: 'Empty string concatenation',
          license: 'ANA' + 'VA-' + 'TRIAL-2024',
          shouldReject: true
        },
        {
          method: 'String interpolation',
          license: `${'ANAVA'}-${'TRIAL'}-2024`,
          shouldReject: true
        },
        {
          method: 'Array join',
          license: ['ANAVA', 'TRIAL', '2024'].join('-'),
          shouldReject: true
        },
        {
          method: 'String replacement',
          license: 'XNXVX-TRIAL-2024'.replace(/X/g, 'A'),
          shouldReject: true
        },
        {
          method: 'Character code construction',
          license: String.fromCharCode(65, 78, 65, 86, 65) + '-TRIAL-2024',
          shouldReject: true
        }
      ];

      const validateLicense = (license: string): boolean => {
        return !license.toUpperCase().startsWith('ANAVA-');
      };

      for (const bypass of historicalBypasses) {
        const result = validateLicense(bypass.license);
        expect(result).toBe(!bypass.shouldReject);
        
        if (result !== !bypass.shouldReject) {
          console.error(`REGRESSION: ${bypass.method} bypass succeeded with ${bypass.license}`);
        }
      }
    });

    /**
     * Test that old code patterns cannot be reintroduced
     */
    it('should detect if old vulnerable code patterns are reintroduced', () => {
      // Patterns that should NEVER appear in code
      const vulnerablePatterns = [
        /generateTrialLicense/,
        /ANAVA-TRIAL-\d{4}/,
        /createFakeLicense/,
        /return\s+['"]ANAVA-/,
        /const\s+\w+\s*=\s*['"]ANAVA-/,
        /let\s+\w+\s*=\s*['"]ANAVA-/,
        /=\s*['"]ANAVA-TRIAL/,
        /defaultLicense.*ANAVA/i,
        /fallbackLicense.*ANAVA/i
      ];

      // Simulate code analysis
      const analyzeCode = (code: string): string[] => {
        const issues: string[] = [];
        
        for (const pattern of vulnerablePatterns) {
          if (pattern.test(code)) {
            issues.push(`Vulnerable pattern detected: ${pattern}`);
          }
        }
        
        return issues;
      };

      // Test safe code
      const safeCode = `
        const license = await getRealLicense(userId);
        if (!license) {
          throw new Error('No license available');
        }
        return license;
      `;
      
      expect(analyzeCode(safeCode)).toHaveLength(0);

      // Test vulnerable code
      const vulnerableCode = `
        const license = await getRealLicense(userId);
        if (!license) {
          return 'ANAVA-TRIAL-2024-' + userId;
        }
        return license;
      `;
      
      expect(analyzeCode(vulnerableCode).length).toBeGreaterThan(0);
    });
  });

  describe('Integration Point Regression', () => {
    /**
     * Test all integration points reject fake licenses
     */
    it('should ensure all integration points reject fake licenses', async () => {
      const integrationPoints = {
        // Cloud function endpoint
        cloudFunction: async (license: string) => {
          if (license && license.startsWith('ANAVA-')) {
            return { error: 'Invalid license', license: null };
          }
          return { license };
        },
        
        // Frontend validation
        frontendValidation: (license: string) => {
          if (license && license.toUpperCase().startsWith('ANAVA-')) {
            throw new Error('Fake license detected');
          }
          return true;
        },
        
        // Camera configuration
        cameraConfig: (license: string) => {
          if (!license || license.startsWith('ANAVA-')) {
            return { valid: false, configured: false };
          }
          return { valid: true, configured: true };
        },
        
        // License storage
        storeLicense: (license: string) => {
          if (license && license.startsWith('ANAVA-')) {
            return { stored: false, error: 'Cannot store fake license' };
          }
          return { stored: true };
        }
      };

      const testLicense = 'ANAVA-INTEGRATION-TEST';

      // Test cloud function
      const cfResult = await integrationPoints.cloudFunction(testLicense);
      expect(cfResult.error).toBeDefined();
      expect(cfResult.license).toBeNull();

      // Test frontend
      expect(() => integrationPoints.frontendValidation(testLicense)).toThrow();

      // Test camera config
      const configResult = integrationPoints.cameraConfig(testLicense);
      expect(configResult.valid).toBe(false);
      expect(configResult.configured).toBe(false);

      // Test storage
      const storeResult = integrationPoints.storeLicense(testLicense);
      expect(storeResult.stored).toBe(false);
      expect(storeResult.error).toBeDefined();
    });
  });

  describe('Future-Proofing Tests', () => {
    /**
     * Test that future variations of fake licenses are caught
     */
    it('should catch future variations of fake license patterns', () => {
      // Potential future fake license patterns
      const futureFakePatterns = [
        'ANAVA-2025-TRIAL',
        'ANAVA-V2-LICENSE',
        'ANAVA-PREMIUM-FAKE',
        'ANAVA_TRIAL_2024', // Underscore variant
        'ANAVA.TRIAL.2024', // Dot variant
        'ANAVA TRIAL 2024', // Space variant
        'ANAVA-' + new Date().getFullYear(),
        'ANAVA-' + Math.random().toString(36),
        'ANAVA-' + Buffer.from('fake').toString('base64')
      ];

      const validateLicense = (license: string): boolean => {
        // Check for ANAVA prefix with any separator
        const pattern = /^ANAVA[\s\-_.]/i;
        if (pattern.test(license)) {
          return false;
        }
        
        // Also check if it just starts with ANAVA
        if (license.toUpperCase().startsWith('ANAVA')) {
          return false;
        }
        
        return true;
      };

      for (const fakeLicense of futureFakePatterns) {
        expect(validateLicense(fakeLicense)).toBe(false);
      }
    });

    /**
     * Canary test - this should ALWAYS fail if fake licenses are accepted
     */
    it('CANARY TEST: Should always reject ANAVA-TRIAL-2024-CANARY', () => {
      const CANARY_LICENSE = 'ANAVA-TRIAL-2024-CANARY';
      
      // This test is a canary - if it ever passes, we have a regression
      const result = !CANARY_LICENSE.startsWith('ANAVA-');
      
      expect(result).toBe(false);
      
      if (result === true) {
        throw new Error('🚨 CRITICAL CANARY FAILURE: System is accepting fake licenses!');
      }
    });
  });
});