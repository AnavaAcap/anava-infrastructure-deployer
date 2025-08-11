# Performance Test Report

**Date**: 2025-08-11T23:12:57.704Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 12.63s
- **Average Test Duration**: 631.45ms
- **Memory Usage**: 30.00 MB / 34.89 MB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| Security Test Suite 1. localStorage Data Sanitization should encrypt sensitive data in localStorage | 55ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 7. Sensitive Data Encryption should use secure key derivation for passwords | 31ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 3. Input Validation & Injection Prevention should validate port numbers are within valid range | 10ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 1. localStorage Data Sanitization should limit localStorage data size to prevent DoS | 9ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 1. localStorage Data Sanitization should sanitize XSS payloads before storing in localStorage | 3ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 2. Credential Handling Security should not log credentials in plaintext | 1ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 2. Credential Handling Security should use secure random tokens for session management | 1ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 3. Input Validation & Injection Prevention should sanitize file paths to prevent path traversal | 1ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 4. Network Scanning Boundaries & Limits should limit concurrent network connections to prevent DoS | 1ms | /src/__tests__/security-tests.spec.ts |
| Security Test Suite 4. Network Scanning Boundaries & Limits should enforce timeout on network scans | 1ms | /src/__tests__/security-tests.spec.ts |

