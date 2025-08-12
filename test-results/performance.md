# Performance Test Report

**Date**: 2025-08-12T00:38:56.207Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 5.85s
- **Average Test Duration**: 292.6ms
- **Memory Usage**: 29.46 MB / 34.89 MB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| Security Test Suite 1. localStorage Data Sanitization should encrypt sensitive data in localStorage | 55ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 7. Sensitive Data Encryption should use secure key derivation for passwords | 31ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 1. localStorage Data Sanitization should limit localStorage data size to prevent DoS | 8ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 4. Network Scanning Boundaries & Limits should rate limit scan requests from same source | 6ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 1. localStorage Data Sanitization should sanitize XSS payloads before storing in localStorage | 3ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 1. localStorage Data Sanitization should validate JSON structure before parsing from localStorage | 1ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 2. Credential Handling Security should not log credentials in plaintext | 1ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 2. Credential Handling Security should use secure random tokens for session management | 1ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 3. Input Validation & Injection Prevention should reject command injection in network range inputs | 1ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 3. Input Validation & Injection Prevention should sanitize file paths to prevent path traversal | 1ms | /src/__tests__/security-tests.spec.ts |

