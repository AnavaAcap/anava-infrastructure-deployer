# Performance Test Report

**Date**: 2025-08-11T23:51:32.042Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 472ms
- **Average Test Duration**: 6.051282051282051ms
- **Memory Usage**: 105.57 MB / 137.48 MB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| 7. Error Recovery and Timeouts should handle ETIMEDOUT errors | 7ms | /src/__tests__/regression-tests-fixed.spec.ts |
| Windows Installer Configuration Build Configuration Consistency should have only one electron-builder configuration file | 1ms | /src/__tests__/windows-installer-regression.spec.ts |
| Windows Installer Configuration Build Configuration Consistency should have consistent perMachine setting | 1ms | /src/__tests__/windows-installer-regression.spec.ts |
| Windows Installer Configuration Build Configuration Consistency should have proper Windows configuration | 1ms | /src/__tests__/windows-installer-regression.spec.ts |
| Windows Installer Configuration NSIS Script Validation should have filesystem tunneling mitigation | 1ms | /src/__tests__/windows-installer-regression.spec.ts |
| Windows Installer Configuration NSIS Script Validation should have comprehensive registry cleanup | 1ms | /src/__tests__/windows-installer-regression.spec.ts |
| Windows Installer Configuration Build Scripts should have VC++ Redistributable download script | 1ms | /src/__tests__/windows-installer-regression.spec.ts |
| Windows Installer Configuration Main Process Cleanup should use WMI for process cleanup on Windows | 1ms | /src/__tests__/windows-installer-regression.spec.ts |
| Registry Management GUID Generation should generate unique GUIDs | 1ms | /src/__tests__/windows-installer-regression.spec.ts |
| Critical Regression Tests v0.9.178 1. Camera Setup State Persistence should save state to localStorage on changes | 1ms | /src/__tests__/regression-tests.spec.ts |

