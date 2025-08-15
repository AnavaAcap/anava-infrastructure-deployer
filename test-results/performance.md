# Performance Test Report

**Date**: 2025-08-15T22:13:12.110Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 31.91s
- **Average Test Duration**: 966.9090909090909ms
- **Memory Usage**: 30.46 MB / 31.64 MB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| Dual Repository Release System Static Download URL Validation should test static download URLs for vision-releases repository | 3ms | /tests/cicd/dualRepositoryRelease.test.ts |
| Dual Repository Release Security Validation Code Signing Security should validate notarization script security | 3ms | /tests/security/dualReleaseSecurityValidation.test.ts |
| Dual Repository Release Security Validation Environment Security should validate no hardcoded credentials in source | 3ms | /tests/security/dualReleaseSecurityValidation.test.ts |
| Dual Repository Release System Release Workflow Validation should have GitHub Actions workflow for automated dual releases | 2ms | /tests/cicd/dualRepositoryRelease.test.ts |
| Dual Repository Release Security Validation Code Signing Security should validate macOS code signing configuration | 2ms | /tests/security/dualReleaseSecurityValidation.test.ts |
| Dual Repository Release System Release Workflow Validation should validate electron-builder configuration for dual output | 1ms | /tests/cicd/dualRepositoryRelease.test.ts |
| Dual Repository Release System Branding Consistency Validation should have no references to old "Anava Installer" branding | 1ms | /tests/cicd/dualRepositoryRelease.test.ts |
| Dual Repository Release System Branding Consistency Validation should have correct Vision Architect sidebar reference | 1ms | /tests/cicd/dualRepositoryRelease.test.ts |
| Dual Repository Release System Port Support Regression Tests should have tests for custom port functionality | 1ms | /tests/cicd/dualRepositoryRelease.test.ts |
| Dual Repository Release System Version Synchronization Tests should ensure version consistency across all files | 1ms | /tests/cicd/dualRepositoryRelease.test.ts |

