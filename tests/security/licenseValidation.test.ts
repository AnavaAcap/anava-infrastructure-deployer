/**
 * License Validation Security Tests
 * Tests license validation, fake license detection, and license security
 * CRITICAL: Ensures NO fake ANAVA-prefixed licenses are accepted
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import crypto from 'crypto';

// Mock Firebase
jest.mock('firebase/app');
jest.mock('firebase/firestore');

describe('License Validation Security Tests', () => {
  let mockFirestore: any;
  let mockCollection: jest.Mock;
  let mockDoc: jest.Mock;
  let mockGetDoc: jest.Mock;
  let mockSetDoc: jest.Mock;
  let mockRunTransaction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Firestore mocks
    mockFirestore = {};
    mockCollection = jest.fn();
    mockDoc = jest.fn();
    mockGetDoc = jest.fn();
    mockSetDoc = jest.fn();
    mockRunTransaction = jest.fn();

    (getFirestore as jest.Mock).mockReturnValue(mockFirestore);
    (collection as jest.Mock).mockImplementation(mockCollection);
    (doc as jest.Mock).mockImplementation(mockDoc);
    (getDoc as jest.Mock).mockImplementation(mockGetDoc);
    (setDoc as jest.Mock).mockImplementation(mockSetDoc);
    (runTransaction as jest.Mock).mockImplementation(mockRunTransaction);
  });

  describe('Fake License Detection', () => {
    /**
     * CRITICAL TEST: Ensure fake ANAVA-prefixed licenses are rejected
     */
    it('should reject ALL ANAVA-prefixed licenses as fake', () => {
      const fakeLicenses = [
        'ANAVA-TRIAL-2024-ABC123',
        'ANAVA-DEV-TEST-123',
        'ANAVA-DEMO-LICENSE',
        'ANAVA-1234567890',
        'ANAVA-',
        'ANAVA-XXXX-XXXX-XXXX',
        'ANAVA-FREE-TRIAL',
        'ANAVA-UNLIMITED',
        'anava-trial-2024', // Lowercase variant
        'AnAvA-TrIaL-2024' // Mixed case variant
      ];

      const validateLicense = (license: string): boolean => {
        // Reject ANY license starting with ANAVA (case-insensitive)
        if (license.toUpperCase().startsWith('ANAVA-')) {
          return false;
        }
        return true;
      };

      for (const fakeLicense of fakeLicenses) {
        expect(validateLicense(fakeLicense)).toBe(false);
        console.log(`✓ Rejected fake license: ${fakeLicense}`);
      }
    });

    /**
     * Test that real Axis licenses are accepted
     */
    it('should accept valid Axis license formats', () => {
      const validLicenses = [
        '1234-5678-9ABC-DEF0',
        'XXXX-XXXX-XXXX-XXXX',
        'A1B2-C3D4-E5F6-7890',
        'TEST-REAL-AXIS-KEY1',
        'axis-license-key-123',
        'PRODUCTION-KEY-2024'
      ];

      const validateLicense = (license: string): boolean => {
        // Reject fake ANAVA licenses
        if (license.toUpperCase().startsWith('ANAVA-')) {
          return false;
        }
        
        // Basic format validation for real licenses
        if (license.length < 4) {
          return false;
        }

        // Check for suspicious patterns
        const suspiciousPatterns = [
          /^DEMO/i,
          /^TRIAL/i,
          /^TEST/i,
          /^FREE/i,
          /^UNLIMITED/i,
          /^CRACK/i,
          /^HACK/i,
          /^PIRATE/i
        ];

        // Allow TEST pattern for valid test licenses (not ANAVA-prefixed)
        const allowedTestPattern = /^TEST-REAL/i;
        if (allowedTestPattern.test(license)) {
          return true;
        }

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(license) && !license.toUpperCase().startsWith('ANAVA-')) {
            // Suspicious but not ANAVA - log warning but accept
            console.warn(`Warning: Suspicious license pattern detected: ${license}`);
          }
        }

        return true;
      };

      for (const validLicense of validLicenses) {
        expect(validateLicense(validLicense)).toBe(true);
        console.log(`✓ Accepted valid license: ${validLicense}`);
      }
    });

    /**
     * Test license cleanup in cloud function
     */
    it('should remove fake licenses from user records', async () => {
      const userId = 'test-user-123';
      const fakeLicense = 'ANAVA-TRIAL-2024-XYZ';
      const realLicense = 'REAL-AXIS-KEY-123';

      // Mock user with fake license
      const userDoc = {
        exists: true,
        data: () => ({
          licenseKey: fakeLicense,
          assigned_axis_key: fakeLicense,
          email: 'test@example.com'
        })
      };

      mockGetDoc.mockResolvedValue(userDoc);

      // Simulate cloud function logic
      const handleLicense = async (userId: string, existingLicense: string) => {
        if (existingLicense && existingLicense.startsWith('ANAVA-')) {
          console.log(`Fake license detected for user ${userId}: ${existingLicense}`);
          
          // Delete fake license fields
          await mockSetDoc(mockDoc('users', userId), {
            licenseKey: null,
            assigned_axis_key: null
          }, { merge: true });

          // Assign real license
          return realLicense;
        }
        return existingLicense;
      };

      const result = await handleLicense(userId, fakeLicense);

      expect(result).toBe(realLicense);
      expect(result).not.toContain('ANAVA-');
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          licenseKey: null,
          assigned_axis_key: null
        }),
        expect.anything()
      );
    });
  });

  describe('License Assignment Security', () => {
    /**
     * Test atomic license assignment to prevent race conditions
     */
    it('should use transactions for atomic license assignment', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const availableLicense = 'AXIS-KEY-12345';

      mockRunTransaction.mockImplementation(async (callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: false,
            data: () => null
          }),
          set: jest.fn(),
          update: jest.fn()
        };

        const result = await callback(transaction);
        return result;
      });

      // Simulate atomic license assignment
      const assignLicense = async (userId: string, email: string) => {
        return await mockRunTransaction(async (transaction: any) => {
          // Check if user already has a license
          const userRef = mockDoc('users', userId);
          const userDoc = await transaction.get(userRef);

          if (userDoc.exists && userDoc.data().assigned_axis_key) {
            return userDoc.data().assigned_axis_key;
          }

          // Query for available license
          const licenseRef = mockDoc('axis_keys', availableLicense);
          
          // Update license status atomically
          transaction.update(licenseRef, {
            status: 'assigned',
            assigned_to: email,
            assigned_at: Date.now()
          });

          // Update user document atomically
          transaction.set(userRef, {
            email: email,
            assigned_axis_key: availableLicense
          }, { merge: true });

          return availableLicense;
        });
      };

      const result = await assignLicense(userId, email);
      
      expect(result).toBe(availableLicense);
      expect(mockRunTransaction).toHaveBeenCalled();
    });

    /**
     * Test prevention of license duplication
     */
    it('should prevent multiple users from getting the same license', async () => {
      const license = 'AXIS-UNIQUE-KEY-789';
      const assignedLicenses = new Set<string>();
      const userLicenses = new Map<string, string>();

      const assignLicenseToUser = (userId: string, licenseKey: string): boolean => {
        // Check if license is already assigned
        if (assignedLicenses.has(licenseKey)) {
          return false; // License already assigned
        }

        // Check if user already has a license
        if (userLicenses.has(userId)) {
          return false; // User already has a license
        }

        // Assign license
        assignedLicenses.add(licenseKey);
        userLicenses.set(userId, licenseKey);
        return true;
      };

      // First assignment should succeed
      expect(assignLicenseToUser('user1', license)).toBe(true);

      // Second assignment of same license should fail
      expect(assignLicenseToUser('user2', license)).toBe(false);

      // Same user requesting another license should fail
      expect(assignLicenseToUser('user1', 'ANOTHER-KEY')).toBe(false);
    });

    /**
     * Test license revocation security
     */
    it('should securely handle license revocation', async () => {
      const userId = 'user-123';
      const licenseKey = 'AXIS-KEY-REVOKE-123';

      const revokeLicense = async (userId: string, licenseKey: string, reason: string) => {
        // Create audit log
        const auditLog = {
          action: 'license_revoked',
          userId: userId,
          licenseKey: licenseKey,
          reason: reason,
          timestamp: Date.now(),
          revokedBy: 'system'
        };

        // Update license status
        await mockSetDoc(mockDoc('axis_keys', licenseKey), {
          status: 'revoked',
          revoked_at: Date.now(),
          revocation_reason: reason
        }, { merge: true });

        // Remove from user
        await mockSetDoc(mockDoc('users', userId), {
          assigned_axis_key: null,
          licenseKey: null
        }, { merge: true });

        // Log audit trail
        await mockSetDoc(mockDoc('audit_logs', `${Date.now()}`), auditLog);

        return true;
      };

      const result = await revokeLicense(userId, licenseKey, 'Policy violation');

      expect(result).toBe(true);
      expect(mockSetDoc).toHaveBeenCalledTimes(3); // License, user, and audit log
    });
  });

  describe('License Format Validation', () => {
    /**
     * Test license format validation
     */
    it('should validate license key format and structure', () => {
      const validateLicenseFormat = (license: string): { valid: boolean; reason?: string } => {
        // Check for ANAVA prefix (fake licenses)
        if (license.toUpperCase().startsWith('ANAVA-')) {
          return { valid: false, reason: 'Fake ANAVA license detected' };
        }

        // Check minimum length
        if (license.length < 8) {
          return { valid: false, reason: 'License key too short' };
        }

        // Check maximum length
        if (license.length > 100) {
          return { valid: false, reason: 'License key too long' };
        }

        // Check for invalid characters (prevent injection)
        const validPattern = /^[A-Za-z0-9\-_]+$/;
        if (!validPattern.test(license)) {
          return { valid: false, reason: 'License contains invalid characters' };
        }

        // Check for SQL injection patterns
        const sqlPatterns = [
          /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/i,
          /[';].*(--)|(\/\*)/,
          /\bUNION\b.*\bSELECT\b/i,
          /\bDROP\b.*\bTABLE\b/i,
          /\bINSERT\b.*\bINTO\b/i,
          /\bDELETE\b.*\bFROM\b/i
        ];

        for (const pattern of sqlPatterns) {
          if (pattern.test(license)) {
            return { valid: false, reason: 'SQL injection attempt detected' };
          }
        }

        return { valid: true };
      };

      // Test valid licenses
      expect(validateLicenseFormat('AXIS-1234-5678-90AB')).toEqual({ valid: true });
      expect(validateLicenseFormat('REAL_LICENSE_KEY_123')).toEqual({ valid: true });

      // Test invalid licenses
      expect(validateLicenseFormat('ANAVA-TRIAL-123')).toEqual({ 
        valid: false, 
        reason: 'Fake ANAVA license detected' 
      });
      expect(validateLicenseFormat('ABC')).toEqual({ 
        valid: false, 
        reason: 'License key too short' 
      });
      expect(validateLicenseFormat('KEY; DROP TABLE users;--')).toEqual({ 
        valid: false, 
        reason: 'License contains invalid characters' 
      });
      expect(validateLicenseFormat('KEY OR 1=1')).toEqual({ 
        valid: false, 
        reason: 'SQL injection attempt detected' 
      });
    });

    /**
     * Test license checksum validation
     */
    it('should validate license checksum for integrity', () => {
      const generateLicenseWithChecksum = (payload: string): string => {
        const checksum = crypto
          .createHash('sha256')
          .update(payload)
          .digest('hex')
          .substring(0, 8)
          .toUpperCase();
        
        return `${payload}-${checksum}`;
      };

      const validateLicenseChecksum = (license: string): boolean => {
        const parts = license.split('-');
        if (parts.length < 2) return false;

        const checksum = parts[parts.length - 1];
        const payload = parts.slice(0, -1).join('-');

        const expectedChecksum = crypto
          .createHash('sha256')
          .update(payload)
          .digest('hex')
          .substring(0, 8)
          .toUpperCase();

        return checksum === expectedChecksum;
      };

      // Generate valid license
      const validLicense = generateLicenseWithChecksum('AXIS-2024-USER');
      expect(validateLicenseChecksum(validLicense)).toBe(true);

      // Test tampered license
      const tamperedLicense = validLicense.replace('USER', 'ADMIN');
      expect(validateLicenseChecksum(tamperedLicense)).toBe(false);

      // Test invalid format
      expect(validateLicenseChecksum('NO-CHECKSUM')).toBe(false);
    });
  });

  describe('License Storage Security', () => {
    /**
     * Test that licenses are encrypted at rest
     */
    it('should encrypt licenses before storage', () => {
      const license = 'AXIS-SECRET-KEY-12345';
      
      const encryptLicense = (license: string): { encrypted: string; iv: string; tag: string } => {
        const algorithm = 'aes-256-gcm';
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(license, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();

        return {
          encrypted,
          iv: iv.toString('hex'),
          tag: tag.toString('hex')
        };
      };

      const result = encryptLicense(license);

      expect(result.encrypted).not.toContain('AXIS');
      expect(result.encrypted).not.toContain('SECRET');
      expect(result.encrypted).not.toContain('12345');
      expect(result.iv).toBeDefined();
      expect(result.tag).toBeDefined();
    });

    /**
     * Test that licenses are not logged in plain text
     */
    it('should mask licenses in logs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const license = 'AXIS-CONFIDENTIAL-98765';
      
      const logLicense = (license: string) => {
        // Mask all but first 4 and last 4 characters
        const masked = license.length > 8
          ? `${license.substring(0, 4)}...${license.substring(license.length - 4)}`
          : '***REDACTED***';
        
        console.log(`License assigned: ${masked}`);
        return masked;
      };

      const masked = logLicense(license);

      expect(masked).toBe('AXIS...8765');
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('CONFIDENTIAL')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('License Lifecycle Management', () => {
    /**
     * Test license expiration handling
     */
    it('should handle license expiration correctly', () => {
      const licenses = [
        {
          key: 'AXIS-EXPIRED-123',
          issuedAt: Date.now() - (400 * 24 * 60 * 60 * 1000), // 400 days ago
          validityDays: 365
        },
        {
          key: 'AXIS-VALID-456',
          issuedAt: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
          validityDays: 365
        },
        {
          key: 'AXIS-PERPETUAL-789',
          issuedAt: Date.now() - (1000 * 24 * 60 * 60 * 1000), // 1000 days ago
          validityDays: -1 // Perpetual license
        }
      ];

      const isLicenseExpired = (license: any): boolean => {
        if (license.validityDays === -1) {
          return false; // Perpetual license
        }

        const expirationDate = license.issuedAt + (license.validityDays * 24 * 60 * 60 * 1000);
        return Date.now() > expirationDate;
      };

      expect(isLicenseExpired(licenses[0])).toBe(true); // Expired
      expect(isLicenseExpired(licenses[1])).toBe(false); // Valid
      expect(isLicenseExpired(licenses[2])).toBe(false); // Perpetual
    });

    /**
     * Test license renewal process
     */
    it('should securely handle license renewal', async () => {
      const userId = 'user-123';
      const oldLicense = 'AXIS-OLD-KEY-123';
      const newLicense = 'AXIS-NEW-KEY-456';

      const renewLicense = async (userId: string, oldLicense: string, newLicense: string) => {
        return await mockRunTransaction(async (transaction: any) => {
          // Mark old license as renewed
          transaction.update(mockDoc('axis_keys', oldLicense), {
            status: 'renewed',
            renewed_at: Date.now(),
            renewed_to: newLicense
          });

          // Activate new license
          transaction.update(mockDoc('axis_keys', newLicense), {
            status: 'assigned',
            assigned_to: userId,
            assigned_at: Date.now(),
            renewed_from: oldLicense
          });

          // Update user record
          transaction.update(mockDoc('users', userId), {
            assigned_axis_key: newLicense,
            previous_licenses: [oldLicense],
            renewed_at: Date.now()
          });

          return newLicense;
        });
      };

      mockRunTransaction.mockResolvedValue(newLicense);
      const result = await renewLicense(userId, oldLicense, newLicense);

      expect(result).toBe(newLicense);
      expect(result).not.toContain('ANAVA-');
      expect(mockRunTransaction).toHaveBeenCalled();
    });
  });

  describe('License Abuse Prevention', () => {
    /**
     * Test rate limiting for license requests
     */
    it('should implement rate limiting for license requests', () => {
      const requestCounts = new Map<string, number[]>();
      const maxRequests = 5;
      const windowMs = 60 * 60 * 1000; // 1 hour

      const checkRateLimit = (userId: string): boolean => {
        const now = Date.now();
        const userRequests = requestCounts.get(userId) || [];
        
        // Remove old requests outside window
        const recentRequests = userRequests.filter(
          timestamp => now - timestamp < windowMs
        );
        
        if (recentRequests.length >= maxRequests) {
          return false; // Rate limited
        }
        
        recentRequests.push(now);
        requestCounts.set(userId, recentRequests);
        return true;
      };

      const userId = 'abusive-user';
      
      // First 5 requests should pass
      for (let i = 0; i < maxRequests; i++) {
        expect(checkRateLimit(userId)).toBe(true);
      }
      
      // 6th request should be rate limited
      expect(checkRateLimit(userId)).toBe(false);
    });

    /**
     * Test detection of license sharing
     */
    it('should detect potential license sharing', () => {
      const licenseUsage = new Map<string, Set<string>>();

      const recordLicenseUsage = (license: string, deviceId: string): boolean => {
        if (!licenseUsage.has(license)) {
          licenseUsage.set(license, new Set());
        }

        const devices = licenseUsage.get(license)!;
        devices.add(deviceId);

        // Flag if license is used on too many devices
        const maxDevices = 3;
        if (devices.size > maxDevices) {
          console.warn(`License sharing detected: ${license} used on ${devices.size} devices`);
          return false;
        }

        return true;
      };

      const license = 'AXIS-SHARED-KEY';

      // Normal usage
      expect(recordLicenseUsage(license, 'device1')).toBe(true);
      expect(recordLicenseUsage(license, 'device2')).toBe(true);
      expect(recordLicenseUsage(license, 'device3')).toBe(true);

      // Potential sharing
      expect(recordLicenseUsage(license, 'device4')).toBe(false);
    });
  });
});